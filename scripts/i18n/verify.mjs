#!/usr/bin/env node
/**
 * 번역 카탈로그 검증 — CI 필수 게이트.
 *
 *   node scripts/i18n/verify.mjs
 *
 * 게이트 1~6은 **결정적**이다(모델 호출 없음). 역번역 채점(게이트 7)은
 * `translate.mjs --review`가 만든 `messages/_meta/review/{locale}.json`을 읽어
 * 미해결 항목만 확인한다 — 검증이 LLM을 부르면 CI가 비결정적이 된다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.argv[1], '../../..');
// 로케일 단일 출처는 `src/shared/i18n/locales.ts`다. 여기에 손으로 적어두면
// 로케일을 추가했을 때 검증이 조용히 그 로케일을 건너뛴다.
const LOCALES = readFileSync(`${ROOT}/src/shared/i18n/locales.ts`, 'utf8')
    .match(/export const LOCALES = \[([^\]]+)\]/)[1]
    .match(/'([a-z-]+)'/g)
    .map(s => s.slice(1, -1));
const SOURCE = 'ko';
const TARGETS = LOCALES.filter(l => l !== SOURCE);

const HANGUL = /[가-힣]/;
const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿]/;
/** ICU 플레이스홀더: `{name}`, `{count, plural, ...}`의 선행 이름. */
const PLACEHOLDER = /\{\s*([A-Za-z0-9_]+)/g;

/**
 * 번역 품질과 무관하게 원문을 그대로 유지해야 하는 값.
 *
 * 기호·숫자만인 값에 더해, **전부 대문자인 짧은 약어**(`GDP`·`RSI`·`ETF`)도
 * 포함한다 — 네 언어가 같은 표기를 쓰므로 "일본어인데 가나·한자가 없다"는
 * 스크립트 검사가 오탐을 낸다.
 */
const PASSTHROUGH = /^(?:[\s\p{P}\p{S}\p{N}]*|[A-Z0-9]{2,6})$/u;

const failures = [];
function fail(gate, detail) {
    failures.push({ gate, detail });
}

function loadCatalog(locale) {
    const path = `${ROOT}/messages/${locale}.json`;
    if (!existsSync(path)) {
        fail('load', `카탈로그 없음: messages/${locale}.json`);
        return {};
    }
    return JSON.parse(readFileSync(path, 'utf8'));
}

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

/**
 * 번역문이 용어집 항목을 (어형 변화를 감안해) 담고 있는가.
 *
 * 정확 일치를 요구하면 정상 번역이 대량으로 걸린다 — 실측에서 `Options` 하나로
 * 21건이 오탐이었고, 그중 하나(`가입은 옵션이며` → `Membership is optional`)는
 * 애초에 다의어라 용어집을 적용하면 **안 되는** 자리였다. 게이트가 늑대를 계속
 * 외치면 사람이 게이트를 끈다.
 */
function containsTerm(text, expected) {
    const haystack = text.toLowerCase();
    const needle = expected.toLowerCase();
    if (haystack.includes(needle)) return true;
    // 복수 → 단수 (`options` → `option`). 역방향(`option` → `options`)은 넣지
    // 않는다 — `needle + 's'`를 담은 문자열은 이미 `needle`을 담고 있어 위 검사가
    // 반드시 먼저 참이 된다(증명 가능한 죽은 분기였다).
    return needle.endsWith('s') && haystack.includes(needle.slice(0, -1));
}

/**
 * ICU `plural`/`select` 블록을 **중괄호 균형**으로 찾는다.
 *
 * 정규식(`[\s\S]*?\}\s*\}`)으로는 못 한다 — 게으른 매칭이 **마지막 분기의
 * 닫는 중괄호를 블록 종료로 먹어치운다.** 그러면 그 분기 내용이 스캔에서 통째로
 * 사라져 두 검사가 동시에 뚫린다(실측):
 *  - 길이: 마지막 분기에 1,026자를 넣어도 렌더 길이가 74자로 계산돼 통과
 *  - 플레이스홀더: 마지막 분기의 `{v9}`가 안 보여 렌더 시 `MissingValueError`
 *
 * @returns `{ start, end, name, branches }` 목록. `branches`는 분기 본문들.
 */
function findIcuBlocks(text) {
    const OPEN =
        /\{\s*([A-Za-z0-9_]+)\s*,\s*(?:plural|select|selectordinal)\s*,/g;
    const blocks = [];
    for (const m of text.matchAll(OPEN)) {
        let depth = 1;
        let i = m.index + m[0].length;
        const branches = [];
        let branchStart = -1;
        while (i < text.length && depth > 0) {
            if (text[i] === '{') {
                if (depth === 1) branchStart = i + 1;
                depth += 1;
            } else if (text[i] === '}') {
                depth -= 1;
                if (depth === 1 && branchStart >= 0) {
                    branches.push(text.slice(branchStart, i));
                    branchStart = -1;
                }
            }
            i += 1;
        }
        if (depth === 0) {
            blocks.push({ start: m.index, end: i, name: m[1], branches });
        }
    }
    return blocks;
}

/**
 * 실제로 **렌더될 때의 길이**. 가장 긴 분기만 남겨 잰다.
 *
 * 분기 안의 중첩 플레이스홀더(`{v9}`)는 길이에 그대로 둔다 — 렌더되면 값이
 * 들어가므로 0으로 치는 것보다 실제에 가깝다.
 */
function renderedLength(text) {
    const source = String(text);
    let out = '';
    let cursor = 0;
    for (const block of findIcuBlocks(source)) {
        if (block.start < cursor) continue;
        const longest = block.branches.reduce(
            (a, b) => (b.length > a.length ? b : a),
            ''
        );
        out += source.slice(cursor, block.start) + longest;
        cursor = block.end;
    }
    return (out + source.slice(cursor)).length;
}

/**
 * 실제로 **값을 제공해야 하는 변수**를 모은다.
 *
 * ICU 블록은 인자 이름(`count`)을 내놓고, 분기 **본문 안의** 변수(`{v9}`)도
 * 그대로 필요하다 — 블록을 통째로 지우면 그게 안 보여서, 마지막 분기에 오타
 * 변수를 넣어도 게이트가 통과하고 렌더 시점에 `MissingValueError`가 난다(실측).
 * 그래서 분기를 재귀로 훑는다. 반면 분기 **키워드**(`one`/`other`/`=1`)는
 * 변수가 아니므로 들어가면 안 된다.
 */
function placeholders(text) {
    const source = String(text);
    const found = new Set();
    let cursor = 0;
    for (const block of findIcuBlocks(source)) {
        if (block.start < cursor) continue;
        for (const m of source
            .slice(cursor, block.start)
            .matchAll(PLACEHOLDER)) {
            found.add(m[1]);
        }
        found.add(block.name);
        for (const branch of block.branches) {
            for (const nested of placeholders(branch)) found.add(nested);
        }
        cursor = block.end;
    }
    for (const m of source.slice(cursor).matchAll(PLACEHOLDER)) {
        found.add(m[1]);
    }
    return found;
}

const catalogs = Object.fromEntries(
    LOCALES.map(locale => [locale, flatten(loadCatalog(locale))])
);
const source = catalogs[SOURCE];
const sourceKeys = Object.keys(source);

const glossaryPath = `${ROOT}/messages/glossary.json`;
const glossary = existsSync(glossaryPath)
    ? JSON.parse(readFileSync(glossaryPath, 'utf8'))
    : {};

// ── 게이트 1: 키 패리티 ──────────────────────────────────────────────────
for (const locale of TARGETS) {
    const target = catalogs[locale];
    const missing = sourceKeys.filter(key => !(key in target));
    const orphans = Object.keys(target).filter(key => !(key in source));
    if (missing.length) {
        fail(
            '1-키-패리티',
            `${locale}: 누락 ${missing.length}개 — 예: ${missing.slice(0, 3).join(', ')}`
        );
    }
    if (orphans.length) {
        fail(
            '1-키-패리티',
            `${locale}: 고아 ${orphans.length}개 — 예: ${orphans.slice(0, 3).join(', ')}`
        );
    }
}

/**
 * 괄호 균형 — 여는 괄호가 JSX에, 닫는 괄호가 메시지에 나뉘어 있으면 번역자가
 * 어순을 바꿀 수 없고 로케일별 괄호 문자(전각 등)도 못 쓴다. 실제로 세 메시지가
 * 그 상태였다: `{v0}) 종합 분석은…`, `{v0}분 지연)`, `{v0}월 {v1}일 ({v2}`.
 *
 * **ko 소스에도 적용한다.** 소스가 깨진 채로 번역되면 세 로케일이 같이 깨지고,
 * 대상 로케일만 보는 검사는 그걸 "충실한 번역"으로 통과시킨다.
 */
function checkBrackets(locale, key, text) {
    /**
     * ICU 분기 **본문**도 검사한다.
     *
     * `text.replace(/\{[^}]*\}/g, '')`는 비재귀라 첫 `}`에서 멈춘다 — 그래서
     * `plural`/`select` 블록 전체가 통째로 지워졌고, 정작 괄호 손상이 눈으로
     * 가장 안 보이는 자리가 검사에서 빠져 있었다.
     */
    const segments = [text, ...findIcuBlocks(text).flatMap(b => b.branches)];
    for (const [open, close] of [
        ['(', ')'],
        ['（', '）'],
        ['[', ']'],
    ]) {
        for (const segment of segments) {
            const bare = segment.replace(/\{[^}]*\}/g, '');
            let depth = 0;
            let broken = false;
            for (const ch of bare) {
                if (ch === open) depth++;
                else if (ch === close && --depth < 0) {
                    broken = true;
                    break;
                }
            }
            if (broken || depth !== 0) {
                fail(
                    '2b-괄호균형',
                    `${locale} ${key}: "${open}${close}" 짝이 안 맞음 "${text.slice(0, 40)}"`
                );
            }
        }
    }
}

/**
 * 빈 값·빈 ICU 분기 — **ko 소스와 대상 로케일 모두** 본다.
 *
 * 빈 문자열은 길이-비율 검사(gate 6)가 20자 미만 원문에서 아예 돌지 않아
 * 그냥 통과했다. UI 라벨 대부분이 20자 미만이라, `en.json`의 값 하나를 `""`로
 * 만들면 그 자리가 화면에서 통째로 사라진 채 게이트가 초록이었다.
 *
 * 빈 ICU 분기 검사도 대상 로케일 루프 안에만 있어서, **기본 로케일**은
 * `No news in the last 3 .` 같은 값을 그대로 내보낼 수 있었다.
 */
function checkEmptiness(locale, key, text) {
    if (text.trim() === '') {
        fail('2c-빈값', `${locale} ${key}: 값이 비어 있다`);
        return;
    }
    for (const block of findIcuBlocks(text)) {
        if (block.branches.some(branch => branch.trim() === '')) {
            fail(
                '2c-빈값',
                `${locale} ${key}: ICU 분기가 비어 있다 ("${block.name}")`
            );
        }
    }
}

// ko 소스 자체의 괄호 균형.
for (const key of sourceKeys) {
    const koText = String(source[key] ?? '');
    checkBrackets('ko', key, koText);
    checkEmptiness('ko', key, koText);
}

// ── 게이트 2~6 ─────────────────────────────────────────────────────────
for (const locale of TARGETS) {
    const target = catalogs[locale];
    for (const key of sourceKeys) {
        const ko = String(source[key] ?? '');
        const value = target[key];
        if (value === undefined) continue;
        const text = String(value);

        // 2. 플레이스홀더 패리티 — 누락되면 런타임에 값이 사라진다.
        const koVars = placeholders(ko);
        const targetVars = placeholders(text);
        if (
            koVars.size !== targetVars.size ||
            [...koVars].some(v => !targetVars.has(v))
        ) {
            fail(
                '2-플레이스홀더',
                `${locale} ${key}: {${[...koVars].join(',')}} → {${[...targetVars].join(',')}}`
            );
        }

        checkBrackets(locale, key, text);

        // 원문이 기호·숫자뿐이면 이후 언어 검사를 적용하지 않는다.
        /**
         * 원문이 기호·숫자뿐이면 이후 언어 검사를 적용하지 않는다.
         *
         * **플레이스홀더를 지우고 판정한다** — `{v0}。`처럼 자리표시자와 구두점만
         * 남는 값(문장 연결자·꼬리)이 "한자 없음"으로 걸렸다. 그 값들은 번역
         * 대상이 맞지만, 언어 스크립트를 요구할 내용이 없다.
         */
        const bareKo = ko.replace(/\{[^}]*\}/g, '');
        const bareText = text.replace(/\{[^}]*\}/g, '');
        // 원문이든 번역이든 **내용이 없으면** 스크립트를 요구할 수 없다.
        // ko `이며, ` → ja `、`처럼 연결자만 남는 값이 그 경우다.
        if (PASSTHROUGH.test(bareKo) || PASSTHROUGH.test(bareText)) continue;

        // 3. 용어집 준수
        for (const [term, translations] of Object.entries(glossary)) {
            const expected = translations[locale];
            if (!expected || !ko.includes(term)) continue;
            // 표기·어형은 문맥이 정한다. `Options` 용어가 `Select Option
            // Expiration`처럼 단수로 쓰이는 것은 정상이고, 문장 첫머리면
            // 대문자가 된다. **용어가 쓰였는지**만 본다.
            if (!containsTerm(text, expected)) {
                fail(
                    '3-용어집',
                    `${locale} ${key}: "${term}" → "${expected}" 미사용`
                );
            }
        }

        // 4. 한글 잔존 — 미번역이 그대로 통과한 경우
        if (HANGUL.test(text)) {
            fail('4-한글잔존', `${locale} ${key}: "${text.slice(0, 40)}"`);
        }

        /**
         * 5. 스크립트 검사 — "일본어 칸에 중국어" 같은 오배치를 잡는다.
         *
         * **고유명사 네임스페이스는 뺀다.** `shared.assetName`은 회사·지수 이름이라
         * `Samsung Electronics`·`Apple`처럼 라틴 표기가 ja/zh에서도 정답이다.
         * 억지로 가나·한자를 넣으면 오히려 통용되지 않는 표기가 된다.
         *
         * `features.ticker-search.popularName`은 그 표의 9개 부분집합이다 —
         * 검색 오버레이가 전 라우트 크롬에 있어 166키짜리 원본을 끌어올 수 없어
         * 따로 뒀다(`SearchOverlay.tsx` 주석). 같은 값이므로 같은 예외가 맞다.
         */
        const isProperNoun =
            key.startsWith('shared.assetName.') ||
            key.startsWith('features.ticker-search.popularName.');

        if (
            !isProperNoun &&
            locale === 'ja' &&
            !KANA.test(text) &&
            !HAN.test(text)
        ) {
            fail(
                '5-스크립트',
                `ja ${key}: 가나·한자 없음 "${text.slice(0, 40)}"`
            );
        }
        if (!isProperNoun && locale === 'zh' && KANA.test(text)) {
            fail(
                '5-스크립트',
                `zh ${key}: 가나 포함(일본어 혼입) "${text.slice(0, 40)}"`
            );
        }
        if (!isProperNoun && locale === 'zh' && !HAN.test(text)) {
            fail('5-스크립트', `zh ${key}: 한자 없음 "${text.slice(0, 40)}"`);
        }
        if (locale === 'en' && (KANA.test(text) || HAN.test(text))) {
            fail('5-스크립트', `en ${key}: CJK 포함 "${text.slice(0, 40)}"`);
        }

        // 6. 길이 상식 — 잘림 또는 환각 장문
        //
        // 짧은 원문에는 비율을 적용하지 않는다. `계정`(2자) → `Account settings`(16자)는
        // 8배지만 정상이다 — 한국어는 한자어 축약이 강해 영어보다 훨씬 짧다.
        // 실측에서 이 규칙 없이 398건이 오탐으로 걸렸다. 절대 하한을 두고, 긴 문장에만
        // 비율을 본다(그쪽에서 잘림·환각이 실제로 문제가 된다).
        // 상한은 추측이 아니라 **실측 분포**에서 정했다. ko→en 265건(20자 이상)의
        // 팽창 비율은 p50 1.78 · p90 2.39 · p99 3.11 · 최대 3.23이었다. 4.0이면
        // 정상 번역은 전부 통과하고, 환각 장문(원문의 5~10배)은 확실히 걸린다.
        // 3.0으로 두면 정상 번역 5건이 걸려 게이트가 늑대를 외친다.
        // 언어마다 압축률이 다르다. 한국어 대비 실측(20자 이상, n=276):
        //   en  min 0.80 · p50 1.83 · max 3.23  (영어가 길다)
        //   ja  min 0.32 · p50 0.96 · max 1.33
        //   zh  min 0.17 · p50 0.62 · max 1.14  (중국어가 훨씬 짧다)
        // 하나의 임계값으로 세 언어를 재면 zh 정상 번역이 대량으로 걸린다.
        const BOUNDS = {
            en: { min: 0.6, max: 4 },
            ja: { min: 0.3, max: 2 },
            zh: { min: 0.15, max: 2 },
        };
        const MIN_KO_LENGTH_FOR_RATIO = 20;
        const bounds = BOUNDS[locale] ?? { min: 0.3, max: 4 };
        // ICU 문법은 화면에 안 나오는 길이다 — `renderedLength`가 가장 긴
        // 분기만 남겨 실제 렌더 길이로 잰다(위 정의 참고).
        /**
         * ICU 분기가 **비어 있는지**는 길이 비율로 못 잡는다 —
         * `renderedLength`는 가장 긴 분기만 보므로 다른 분기를 지워도 총량이
         * 그대로다(실측: `other {days}}` → `other {}}`가 통과했고, 렌더하면
         * `No news in the last 3 .`가 된다).
         */
        checkEmptiness(locale, key, text);

        if (ko.length >= MIN_KO_LENGTH_FOR_RATIO) {
            const ratio = renderedLength(text) / ko.length;
            if (ratio < bounds.min || ratio > bounds.max) {
                fail(
                    '6-길이',
                    `${locale} ${key}: 비율 ${ratio.toFixed(2)} (${ko.length}자 → ${text.length}자)`
                );
            }
        }
    }
}

// ── 게이트 8: ICU 따옴표 이스케이프 ──────────────────────────────────────
//
// 작은따옴표는 ICU의 이스케이프 문자다. `'{v0}'`은 리터럴 `{v0}`으로 읽혀
// **치환이 조용히 건너뛰어지고** 화면에 `{v0}`이 그대로 나온다. 리터럴 따옴표는
// `''`로 써야 한다. 번역 모델이 원문의 `''`를 `'`로 되돌리는 일이 잦아
// 모든 로케일을 검사한다.
for (const locale of LOCALES) {
    for (const [key, raw] of Object.entries(catalogs[locale])) {
        const text = String(raw);
        if (!text.includes('{')) continue;
        // 홀수 개의 연속 따옴표가 중괄호 앞에 오면 이스케이프가 깨진 것이다.
        if (/(^|[^'])'(\{|\w*\{)/.test(text)) {
            fail(
                '8-ICU따옴표',
                `${locale} ${key}: "${text.slice(0, 50)}" — 리터럴 따옴표는 ''로 써야 한다`
            );
        }
    }
}

// ── 게이트 7: 역번역 검토 대기 ────────────────────────────────────────────
for (const locale of TARGETS) {
    const path = `${ROOT}/messages/_meta/review/${locale}.json`;
    if (!existsSync(path)) continue;
    const pending = JSON.parse(readFileSync(path, 'utf8')).filter(
        entry => !entry.approved
    );
    if (pending.length) {
        fail(
            '7-역번역검토',
            `${locale}: 인간 승인 대기 ${pending.length}건 — messages/_meta/review/${locale}.json`
        );
    }
}

// ── 결과 ────────────────────────────────────────────────────────────────
if (failures.length === 0) {
    console.log(
        `✓ i18n 검증 통과 — ${sourceKeys.length}키 × ${TARGETS.length}로케일`
    );
    process.exit(0);
}

const byGate = failures.reduce((acc, f) => {
    (acc[f.gate] ??= []).push(f.detail);
    return acc;
}, {});
for (const [gate, details] of Object.entries(byGate).sort()) {
    console.error(`\n✗ ${gate} — ${details.length}건`);
    for (const detail of details.slice(0, 15)) console.error(`    ${detail}`);
    if (details.length > 15) console.error(`    … 외 ${details.length - 15}건`);
}
console.error(`\n총 ${failures.length}건 실패`);
process.exit(1);
