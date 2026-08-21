#!/usr/bin/env node
/**
 * 미추출 한국어 리터럴 차단 게이트.
 *
 *   node scripts/i18n/lint.mjs               기준선 대비 신규 위반만 실패
 *   node scripts/i18n/lint.mjs --update       현재 상태를 기준선으로 기록
 *
 * **왜 기준선(baseline) 방식인가**: 전면 마이그레이션은 여러 PR에 걸쳐 진행된다.
 * 처음부터 0을 요구하면 게이트를 켤 수가 없고, 켜지 못하면 그사이 새 한국어가
 * 계속 유입돼 마이그레이션이 영원히 끝나지 않는다. 기준선은 "지금보다 나빠지지
 * 않는다"만 강제하고, 마이그레이션이 진행될수록 `--update`로 조여진다.
 *
 * 기준선은 파일 단위 카운트다. 줄 번호로 잡으면 무관한 편집마다 흔들린다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    candidateFiles,
    collectCandidates,
    parseFile,
    readSource,
} from './lib/scan.mjs';
import { classify } from './lib/context.mjs';

const ROOT = resolve(process.argv[1], '../../..');
const UPDATE = process.argv.includes('--update');
const BASELINE_PATH = `${ROOT}/messages/_meta/lint-baseline.json`;

const counts = {};
for (const relPath of candidateFiles(ROOT)) {
    const code = readSource(ROOT, relPath);
    let ast;
    try {
        ast = parseFile(relPath, code);
    } catch {
        continue;
    }
    let violations = 0;
    for (const candidate of collectCandidates(ast, code)) {
        const verdict = classify({ candidate, filePath: relPath, code });
        // 위반이 아닌 것들:
        // - 이미 번역됨 / 모듈 경로·타입 리터럴
        // - SEO 키워드: 번역 대상이 아니라 ko 전용 데이터다(seoAlternates.ts 참고)
        if (
            verdict.reason === 'already-translated' ||
            verdict.reason === 'module-specifier' ||
            verdict.reason === 'seo-keywords-ko-only' ||
            // 표시 번역이 카탈로그로 옮겨진 데이터 config — 여기 남은 한국어는
            // 원본 데이터이고 화면은 카탈로그를 조회한다(§context.mjs).
            verdict.reason === 'catalog-backed-data' ||
            // 콘솔 로그·`[모듈]` 접두 throw — 운영자만 읽는다(§context.mjs).
            verdict.reason === 'developer-diagnostic' ||
            // E2E 전용 스텁 — 프로덕션 렌더 경로에 닿지 않는다(§context.mjs).
            // `build*Prompt()` 안의 모델 지시문 — 화면 문구가 아니다.
            verdict.reason === 'ai-prompt' ||
            verdict.reason === 'e2e-stub' ||
            // 한국어 조사 규칙 — 번역 대상이 아니다(§context.mjs).
            verdict.reason === 'ko-grammar' ||
            // 언어 스위처의 자국어 표기 — 번역하면 기능이 망가진다.
            verdict.reason === 'native-language-label' ||
            // use-case의 로그·폴백 원문 — 표시는 UI가 코드로 번역한다.
            verdict.reason === 'log-fallback-message'
        ) {
            continue;
        }
        violations += 1;
    }
    if (violations > 0) counts[relPath] = violations;
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (UPDATE) {
    writeFileSync(
        BASELINE_PATH,
        JSON.stringify(
            Object.fromEntries(
                // 코드포인트 정렬 — `localeCompare`는 ICU 로케일에 의존해
                // 환경마다 출력 순서가 갈린다(extract.mjs 주석 참고).
                Object.entries(counts).sort(([a], [b]) =>
                    a < b ? -1 : a > b ? 1 : 0
                )
            ),
            null,
            4
        ) + '\n'
    );
    console.log(`기준선 갱신: ${Object.keys(counts).length}파일 / ${total}건`);
    process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {};

const regressions = [];
for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) {
        regressions.push(
            `${file}: ${allowed} → ${count} (+${count - allowed})`
        );
    }
}

const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`미추출 한국어: ${total}건 (기준선 ${baselineTotal}건)`);

if (regressions.length === 0) {
    if (total < baselineTotal) {
        console.log(
            `✓ 기준선보다 ${baselineTotal - total}건 감소 — \`yarn i18n:lint --update\`로 조이세요`
        );
    }
    process.exit(0);
}

console.error(`\n✗ 신규 미추출 한국어 ${regressions.length}파일`);
for (const line of regressions) console.error(`    ${line}`);
console.error(
    '\n`yarn i18n:extract --apply --only <경로>`로 추출하거나, 사용자에게 보이지 않는 문자열이면 scripts/i18n/lib/scan.mjs의 제외 규칙에 추가하세요.'
);
process.exit(1);
