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
const LOCALES = ['ko', 'en', 'ja', 'zh'];
const SOURCE = 'ko';
const TARGETS = LOCALES.filter(l => l !== SOURCE);

const HANGUL = /[가-힣]/;
const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿]/;
/** ICU 플레이스홀더: `{name}`, `{count, plural, ...}`의 선행 이름. */
const PLACEHOLDER = /\{\s*([A-Za-z0-9_]+)/g;

/** 번역 품질과 무관하게 원문을 그대로 유지해야 하는 값. */
const PASSTHROUGH = /^[\s\p{P}\p{S}\p{N}]*$/u;

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
    // 복수 → 단수 (`options` → `option`)
    if (needle.endsWith('s') && haystack.includes(needle.slice(0, -1))) {
        return true;
    }
    // 단수 → 복수
    return haystack.includes(`${needle}s`);
}

function placeholders(text) {
    return new Set([...String(text).matchAll(PLACEHOLDER)].map(m => m[1]));
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

        // 원문이 기호·숫자뿐이면 이후 언어 검사를 적용하지 않는다.
        if (PASSTHROUGH.test(ko)) continue;

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

        // 5. 스크립트 검사 — "일본어 칸에 중국어" 같은 오배치를 잡는다
        if (locale === 'ja' && !KANA.test(text) && !HAN.test(text)) {
            fail(
                '5-스크립트',
                `ja ${key}: 가나·한자 없음 "${text.slice(0, 40)}"`
            );
        }
        if (locale === 'zh' && KANA.test(text)) {
            fail(
                '5-스크립트',
                `zh ${key}: 가나 포함(일본어 혼입) "${text.slice(0, 40)}"`
            );
        }
        if (locale === 'zh' && !HAN.test(text)) {
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
        if (ko.length >= MIN_KO_LENGTH_FOR_RATIO) {
            const ratio = text.length / ko.length;
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
