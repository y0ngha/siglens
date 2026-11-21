import { describe, expect, it } from 'vitest';
import { buildRuleDocReport } from '../rule-doc-size';

describe('buildRuleDocReport', () => {
    const sizes = [
        { file: 'small.md', bytes: 100 },
        { file: 'big.md', bytes: 900 },
        { file: 'mid.md', bytes: 400 },
    ];

    it('파일을 큰 순서로 늘어놓고 합계·예산·여유분을 붙인다', () => {
        const { output, exitCode } = buildRuleDocReport(sizes, 2000);
        const lines = output.split('\n');

        expect(lines.map(line => line.trim().split(/\s+/)[1])).toEqual([
            'big.md',
            'mid.md',
            'small.md',
            'total',
            'budget',
            'headroom',
        ]);
        expect(lines[3]?.trim()).toBe('1400  total');
        expect(lines[5]?.trim()).toBe('600  headroom');
        expect(exitCode).toBe(0);
    });

    it('예산과 정확히 같으면 통과한다', () => {
        expect(buildRuleDocReport(sizes, 1400).exitCode).toBe(0);
    });

    it('예산을 넘으면 음수 여유분과 종료 코드 1', () => {
        const { output, exitCode } = buildRuleDocReport(sizes, 1000);

        expect(output).toContain('-400  headroom (OVER BUDGET)');
        expect(exitCode).toBe(1);
    });

    it('예산 줄이 없으면 종료 코드 1', () => {
        const { output, exitCode } = buildRuleDocReport(sizes, null);

        expect(output).toContain('Rule-document budget');
        expect(exitCode).toBe(1);
    });
});
