import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    judgeBudget,
    measureRuleDocs,
    parseBudget,
    ruleDocPaths,
    totalBytes,
    type RuleDocSize,
} from './support/ruleDocs';

/**
 * 규칙 문서는 에이전트가 한 번에 끝까지 읽을 수 있는 길이로 유지한다.
 *
 * 리뷰 에이전트·CI 리뷰 봇은 Read 도구로 규칙 문서를 통째로 읽는데, Read는 한 번에 2,000줄까지만
 * 돌려주고 잘렸다고 알려 주지 않는다. 문서가 그보다 길면 뒷부분 규칙이 리뷰에서 소리 없이 빠진다.
 * 끊어 읽으라고 지시하는 대신 문서를 주제별로 나눠 두고(`CONVENTIONS.md`·`REACT.md`·`SERVER.md`…),
 * 다시 커지면 여기서 막는다. 상한을 2,000보다 낮게 잡아 쪼갤 여유를 남긴다.
 *
 * 줄 수와 별개로 총 바이트 예산도 둔다. 리뷰 한 번이 규칙 문서를 수백 KB씩 읽으므로, 규칙을 더할 때마다
 * 읽기 비용이 같이 는다. 예산은 루트 `CLAUDE.md`의 `Rule-document budget: N bytes.` 한 줄이고 내려가기만
 * 한다. 넘으면 새 규칙을 얹기 전에 중복·강제된 규칙을 줄이거나 폐기한다(`mistake-managing-agent`의 의무).
 */

const ROOT = path.resolve(__dirname, '../../..');
const MAX_LINES = 1500;

function lineCount(file: string): number {
    return readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
}

const budgetViolation = (
    sizes: readonly RuleDocSize[],
    budget: number | null
): string | null => judgeBudget(sizes, budget).violation;

describe('rule document size', () => {
    it(`every rule document stays at or under ${MAX_LINES} lines`, () => {
        const oversized = ruleDocPaths(ROOT)
            .map(file => ({ file, lines: lineCount(file) }))
            .filter(({ lines }) => lines > MAX_LINES)
            .map(({ file, lines }) => `${file}: ${lines} lines`);
        expect(oversized).toEqual([]);
    });

    it('scans the convention documents, so the check cannot pass vacuously', () => {
        expect(ruleDocPaths(ROOT)).toEqual(
            expect.arrayContaining([
                'docs/conventions/CONVENTIONS.md',
                'docs/conventions/REACT.md',
                'docs/conventions/SERVER.md',
            ])
        );
    });
});

describe('rule document byte budget', () => {
    it('the live rule documents fit the budget declared in CLAUDE.md', () => {
        const budget = parseBudget(
            readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8')
        );
        expect(budgetViolation(measureRuleDocs(ROOT), budget)).toBeNull();
    });

    it('measures every rule document with real bytes', () => {
        const sizes = measureRuleDocs(ROOT);
        expect(sizes).toHaveLength(ruleDocPaths(ROOT).length);
        expect(totalBytes(sizes)).toBeGreaterThan(100_000);
    });

    it('measures UTF-8 bytes, not characters', () => {
        // 한글 한 글자는 3바이트라 문자 수로 세면 예산이 3배 느슨해진다.
        const sizes = measureRuleDocs(ROOT);
        const claude = sizes.find(({ file }) => file === 'CLAUDE.md');
        const text = readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
        expect(claude?.bytes).toBe(Buffer.byteLength(text, 'utf8'));
        expect(claude?.bytes).toBeGreaterThan(text.length);
    });

    it('fails with a per-file table when a planted size map is over budget', () => {
        const message = budgetViolation(
            [
                { file: 'a.md', bytes: 600 },
                { file: 'b.md', bytes: 500 },
            ],
            1000
        );
        expect(message).toContain('exceed the budget');
        expect(message).toContain('a.md');
        expect(message).toContain('b.md');
        expect(message).toContain('-100  headroom (OVER BUDGET)');
    });

    it('passes exactly at the budget', () => {
        expect(
            budgetViolation([{ file: 'a.md', bytes: 1000 }], 1000)
        ).toBeNull();
    });

    it('fails when the budget line is missing or duplicated', () => {
        const line = 'Rule-document budget: 420,000 bytes.';
        expect(parseBudget(`# Doc\n\n${line}\n`)).toBe(420000);
        expect(parseBudget('# Doc\nno budget here\n')).toBeNull();
        expect(parseBudget(`${line}\n\n${line}\n`)).toBeNull();
        expect(budgetViolation([], parseBudget('# Doc\n'))).toContain(
            'exactly one'
        );
        expect(
            budgetViolation([], parseBudget(`${line}\n${line}\n`))
        ).toContain('exactly one');
    });
});
