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
            if (!text.includes(expected)) {
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
        const ratio = text.length / Math.max(ko.length, 1);
        if (ratio < 0.4 || ratio > 3) {
            fail(
                '6-길이',
                `${locale} ${key}: 비율 ${ratio.toFixed(2)} (${ko.length}자 → ${text.length}자)`
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
