/**
 * 규칙 문서 총량 점검(읽기 전용). `yarn rules:size`.
 *
 * `ruleDocSize.test.ts` 가드와 같은 목록·같은 예산(루트 `CLAUDE.md`의 `Rule-document budget` 줄)으로
 * 파일별 바이트, 합계, 여유분을 보여 준다. `mistake-managing-agent`가 규칙을 더하기 전에 여유분을
 * 확인하는 데 쓴다. 예산 초과이거나 예산 줄이 없으면 종료 코드 1.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    judgeBudget,
    measureRuleDocs,
    parseBudget,
    type RuleDocSize,
} from '../src/__tests__/guards/support/ruleDocs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface RuleDocReport {
    readonly output: string;
    readonly exitCode: 0 | 1;
}

/** 표와 종료 코드. 예산 줄이 없으면 1, 합계가 예산 이하면 0, 넘으면 1. */
export function buildRuleDocReport(
    sizes: readonly RuleDocSize[],
    budget: number | null
): RuleDocReport {
    const { violation, output } = judgeBudget(sizes, budget);
    return { output, exitCode: violation === null ? 0 : 1 };
}

const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
    const report = buildRuleDocReport(
        measureRuleDocs(ROOT),
        parseBudget(readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8'))
    );
    console.log(report.output);
    process.exitCode = report.exitCode;
}
