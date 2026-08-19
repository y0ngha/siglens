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
        const verdict = classify({ candidate, filePath: relPath });
        // 위반이 아닌 것들:
        // - 이미 번역됨 / 모듈 경로·타입 리터럴
        // - SEO 키워드: 번역 대상이 아니라 ko 전용 데이터다(seoAlternates.ts 참고)
        if (
            verdict.reason === 'already-translated' ||
            verdict.reason === 'module-specifier' ||
            verdict.reason === 'seo-keywords-ko-only'
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
                Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
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
