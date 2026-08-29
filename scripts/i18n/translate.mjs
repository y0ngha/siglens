#!/usr/bin/env node
/**
 * ko 카탈로그 → en/ja/zh 기계번역.
 *
 *   node scripts/i18n/translate.mjs --locale en
 *   node scripts/i18n/translate.mjs --locale ja --all       (변경분만이 아니라 전량)
 *   node scripts/i18n/translate.mjs --locale en --review    (역번역 채점까지)
 *
 * **변경분만 번역한다** — `messages/_meta/hashes.json`에 저장된 ko 콘텐츠 해시와
 * 비교해 달라진 키만 보낸다. 전량 재번역은 비용도 문제지만, 이미 사람이 승인한
 * 번역을 매번 흔들어 리뷰를 무의미하게 만든다.
 *
 * 프로바이더는 기존 SDK를 재사용한다(신규 SaaS 의존 0). 기본은
 * `gemini-2.5-flash` — 짧은 UI 문자열 번역에 추론 예산이 필요 없다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const ROOT = resolve(process.argv[1], '../../..');
const args = process.argv.slice(2);
const locale = args[args.indexOf('--locale') + 1];
const TRANSLATE_ALL = args.includes('--all');
const WITH_REVIEW = args.includes('--review');
const DRY_RUN = args.includes('--dry-run');

const LOCALE_NAME = {
    en: 'English (US)',
    ja: 'Japanese',
    zh: 'Simplified Chinese (zh-Hans)',
};

if (!locale || !(locale in LOCALE_NAME)) {
    console.error(
        `--locale 은 ${Object.keys(LOCALE_NAME).join('|')} 중 하나여야 한다`
    );
    process.exit(1);
}

/** 한 번에 보내는 문자열 수. 너무 크면 모델이 중간을 흘리고, 너무 작으면 왕복이 는다. */
const BATCH_SIZE = 40;

function flatten(node, prefix = '', out = {}) {
    for (const [key, value] of Object.entries(node)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, path, out);
        } else {
            out[path] = value;
        }
    }
    return out;
}

function setPath(root, path, value) {
    const segments = path.split('.');
    let node = root;
    for (const segment of segments.slice(0, -1)) {
        node[segment] ??= {};
        node = node[segment];
    }
    node[segments[segments.length - 1]] = value;
}

const readJson = path =>
    existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};

const source = flatten(readJson(`${ROOT}/messages/ko.json`));
const target = flatten(readJson(`${ROOT}/messages/${locale}.json`));
const hashes = readJson(`${ROOT}/messages/_meta/hashes.json`);
const glossary = readJson(`${ROOT}/messages/glossary.json`);

const hashOf = text =>
    createHash('sha1').update(text).digest('hex').slice(0, 12);

const stale = Object.keys(source).filter(key => {
    if (TRANSLATE_ALL) return true;
    if (!(key in target)) return true;
    return hashes[key] !== hashOf(String(source[key]));
});

console.log(`대상 로케일: ${locale} (${LOCALE_NAME[locale]})`);
console.log(`전체 키:     ${Object.keys(source).length}`);
console.log(`번역 필요:   ${stale.length}`);

if (stale.length === 0) {
    // 번역할 게 없어도 **고아 키는 정리한다.** ko 카탈로그가 줄어든 뒤에도
    // 대상 카탈로그에 옛 키가 남으면 검증 게이트가 계속 실패하고, 그 소음에
    // 진짜 누락이 묻힌다.
    const pruned = pruneOrphans();
    console.log(
        pruned > 0 ? `고아 ${pruned}개 정리 — 종료` : '변경 없음 — 종료'
    );
    process.exit(0);
}
if (DRY_RUN) {
    for (const key of stale.slice(0, 20)) {
        console.log(`  ${key}: ${String(source[key]).slice(0, 60)}`);
    }
    process.exit(0);
}

const glossaryLines = Object.entries(glossary)
    .filter(([, translations]) => translations[locale])
    .map(([term, translations]) => `  "${term}" → "${translations[locale]}"`)
    .join('\n');

function buildPrompt(batch) {
    return `You are localizing the UI of a Korean stock-market analysis web app into ${LOCALE_NAME[locale]}.

Rules:
- Translate the VALUE of each entry. Keep the KEY unchanged.
- Preserve ICU placeholders exactly: {count}, {symbol}, {name}. Never translate or reorder the token inside braces.
- Preserve markdown, HTML entities, and leading/trailing whitespace.
- Ticker symbols (AAPL, 005930.KS), indicator names in Latin (RSI, MACD), and brand names stay as-is.
- Use the register of a professional finance product: concise, neutral, no marketing fluff.
- Never add explanations. Output JSON only.
${glossaryLines ? `\nLocked terminology (use exactly):\n${glossaryLines}\n` : ''}
Input is a JSON object of key → Korean text.
Output a JSON object with the SAME keys and translated values. No other text.

${JSON.stringify(Object.fromEntries(batch.map(k => [k, source[k]])), null, 0)}`;
}

/**
 * Gemini 호출.
 *
 * `@google/genai`는 이미 의존성에 있다. 키가 없으면 즉시 실패시킨다 —
 * 조용히 원문을 복사하면 4번 게이트(한글 잔존)에서야 드러나는데, 그때는
 * 어디까지가 진짜 번역인지 알 수 없다.
 */
async function callModel(prompt) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 없다');
        process.exit(1);
    }
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0 },
    });
    return parseModelJson(response.text);
}

/**
 * 모델 JSON 파싱 — `jsonrepair` 폴백.
 *
 * `responseMimeType: 'application/json'`을 줘도 깨진 이스케이프가 섞여 나온다
 * (실측: 42번째 배치에서 `Bad escaped character in JSON`). 한국어 원문에 따옴표·
 * 백슬래시가 들어 있으면 확률이 올라간다. `jsonrepair`는 이미 의존성에 있다.
 */
function parseModelJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        const { jsonrepair } = require('jsonrepair');
        return JSON.parse(jsonrepair(text));
    }
}

/**
 * 대상 카탈로그에서 시작하되 **ko에 없는 키는 버린다**(고아 정리).
 *
 * ko 카탈로그는 codemod가 재생성하므로 키가 사라지기도 한다(치환하지 않기로
 * 바뀐 문자열, 이름이 바뀐 컴포넌트 등). 남겨 두면 검증 게이트가 "고아 키"로
 * 계속 실패하고, 무엇이 진짜 누락인지 묻힌다.
 */
const nextTarget = Object.fromEntries(
    Object.entries(target).filter(([key]) => key in source)
);

/** ko에 없는 키를 대상 카탈로그에서 지우고 지운 개수를 돌려준다. */
function pruneOrphans() {
    const removed = Object.keys(target).filter(key => !(key in source)).length;
    if (removed > 0) persist();
    return removed;
}
const nextHashes = { ...hashes };

/**
 * 지금까지의 번역을 디스크에 쓴다.
 *
 * **배치마다 저장한다.** 한 배치가 실패했다고 앞선 수십 배치를 버리면 안 된다 —
 * 실측으로 41배치(1,640키) 분량이 42번째의 JSON 오류 하나로 날아갔다. 재실행은
 * `hashes.json` 덕분에 남은 것만 이어서 번역한다.
 */
function persist() {
    const nested = {};
    for (const key of Object.keys(nextTarget).sort((a, b) =>
        // 코드포인트 정렬 — extract.mjs 주석 참고.
        a < b ? -1 : a > b ? 1 : 0
    )) {
        setPath(nested, key, nextTarget[key]);
    }
    writeFileSync(
        `${ROOT}/messages/${locale}.json`,
        JSON.stringify(nested, null, 4) + '\n'
    );
    mkdirSync(`${ROOT}/messages/_meta`, { recursive: true });
    writeFileSync(
        `${ROOT}/messages/_meta/hashes.json`,
        JSON.stringify(nextHashes, null, 4) + '\n'
    );
}

const failedBatches = [];
for (let index = 0; index < stale.length; index += BATCH_SIZE) {
    const batch = stale.slice(index, index + BATCH_SIZE);
    let translated;
    try {
        translated = await callModel(buildPrompt(batch));
    } catch (error) {
        // 한 번만 재시도한다. 같은 프롬프트가 두 번 깨지면 그 배치는 건너뛰고
        // 다음으로 간다 — 남은 키는 다음 실행이 `hashes.json`을 보고 다시 집는다.
        console.warn(`  ⚠ 배치 ${index} 실패, 재시도: ${error.message}`);
        try {
            translated = await callModel(buildPrompt(batch));
        } catch (retryError) {
            console.error(`  ✗ 배치 ${index} 건너뜀: ${retryError.message}`);
            failedBatches.push(index);
            continue;
        }
    }
    for (const key of batch) {
        const value = translated[key];
        if (typeof value !== 'string') {
            console.warn(`  ⚠ 누락: ${key}`);
            continue;
        }
        nextTarget[key] = value;
        nextHashes[key] = hashOf(String(source[key]));
    }
    persist();
    console.log(
        `  ${Math.min(index + BATCH_SIZE, stale.length)}/${stale.length}`
    );
}

console.log(`✓ messages/${locale}.json 갱신`);
if (failedBatches.length > 0) {
    console.warn(
        `⚠ 실패한 배치 ${failedBatches.length}개 — 다시 실행하면 남은 키만 이어서 번역한다`
    );
}

// ── 역번역 채점 ──────────────────────────────────────────────────────────
if (!WITH_REVIEW) {
    console.log('역번역 채점은 --review 로 실행한다');
    process.exit(0);
}

/**
 * 번역문을 한국어로 되돌린 뒤 원문과의 의미 동등성을 1~5로 채점한다.
 *
 * 4점 미만만 `_meta/review/{locale}.json`에 적재하고, `verify.mjs`가 그 파일에
 * 미승인 항목이 남아 있으면 CI를 실패시킨다. 사람이 `approved: true`를 달아야
 * 통과한다 — "기계번역이니 대충"을 막는 지점이다.
 */
const reviewPath = `${ROOT}/messages/_meta/review/${locale}.json`;
mkdirSync(`${ROOT}/messages/_meta/review`, { recursive: true });
const existingReview = readJson(reviewPath);
const approved = new Set(
    (Array.isArray(existingReview) ? existingReview : [])
        .filter(entry => entry.approved)
        .map(entry => entry.key)
);

const flagged = [];
for (let index = 0; index < stale.length; index += BATCH_SIZE) {
    const batch = stale
        .slice(index, index + BATCH_SIZE)
        .filter(k => !approved.has(k));
    if (batch.length === 0) continue;
    const scored = await callModel(
        `You are a bilingual reviewer (Korean ↔ ${LOCALE_NAME[locale]}) for a finance app.
For each entry, compare the Korean SOURCE with the TRANSLATION.
Score semantic equivalence 1-5 (5 = fully equivalent, 1 = wrong meaning).
Penalize: dropped/added facts, changed numbers, wrong finance terminology, wrong politeness register.
Output JSON: { "<key>": { "score": <1-5>, "note": "<short reason in Korean>" } }. No other text.

${JSON.stringify(
    Object.fromEntries(
        batch.map(k => [k, { source: source[k], translation: nextTarget[k] }])
    )
)}`
    );
    for (const key of batch) {
        const verdict = scored[key];
        if (!verdict || verdict.score >= 4) continue;
        flagged.push({
            key,
            ko: source[key],
            translation: nextTarget[key],
            score: verdict.score,
            note: verdict.note ?? '',
            approved: false,
        });
    }
    console.log(
        `  채점 ${Math.min(index + BATCH_SIZE, stale.length)}/${stale.length}`
    );
}

writeFileSync(reviewPath, JSON.stringify(flagged, null, 4) + '\n');
console.log(
    flagged.length === 0
        ? '✓ 역번역 채점 — 검토 대상 없음'
        : `⚠ 역번역 채점 — ${flagged.length}건 검토 필요: ${reviewPath}`
);
