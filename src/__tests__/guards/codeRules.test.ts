import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CODE_RULES,
    MIN_SCANNED_FILES,
    checkScanFloor,
    isTestFile,
    scanRepo,
    scanSources,
    type CodeRule,
    type RuleCounts,
} from './support/codeRules';
import {
    BASELINE_PATH,
    compareAgainst,
    compareToBaseline,
    describeComparison,
    initialBaseline,
    moveBaselineEntry,
    parseBaseline,
    serializeBaseline,
    tightenBaseline,
    type Baseline,
} from './support/codeRulesBaseline';
import { SCAN_TIMEOUT_MS } from './support/controlUsage';

/**
 * **코드 규칙 기준선 가드** (CONVENTIONS.md "Enforced rules", TOOLCHAIN.md#TC-41).
 *
 * lint에 없는 AST 규칙을 한 엔진(`support/codeRules.ts`)으로 돌린다. `zero` 규칙은 위반이 하나라도
 * 있으면 실패하고, `ratchet` 규칙은 파일별 위반 수를 `codeRules.baseline.json`에 얼려 두고 그보다 늘면
 * 실패한다. 새 파일은 기준선에 없으므로 0에서 시작한다. 파일이 사라진 항목은 낡은 항목으로 실패하고,
 * 파일이 있는데 0이 된 항목은 통과하되 `yarn rules:ratchet --tighten`을 주기적으로 돌려 지운다. 올리는 경로는 없다.
 */

const ROOT = path.resolve(__dirname, '../../..');

const liveScan = (() => {
    const cache: { value?: ReturnType<typeof scanRepo> } = {};
    return () => (cache.value ??= scanRepo(ROOT));
})();

const liveBaseline = (): Baseline =>
    parseBaseline(readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8'));

const ruleKeys = CODE_RULES.map(rule => rule.key);

describe('code rules: live repository', () => {
    it(
        'the engine scans the repository without parse errors or broken predicates',
        () => {
            const scan = liveScan();
            expect(scan.problems).toEqual([]);
            expect(scan.scanned).toBeGreaterThan(MIN_SCANNED_FILES);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        'no rule regresses against the baseline and no entry is stale',
        () => {
            const comparison = compareToBaseline(
                liveScan().counts,
                liveBaseline(),
                new Set(liveScan().paths)
            );
            expect(describeComparison(comparison)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        'is not vacuous: the baseline still records violations the engine finds',
        () => {
            const { counts } = liveScan();
            const baseline = liveBaseline();
            expect(
                Object.keys(counts['non-null-assertion'] ?? {}).length
            ).toBeGreaterThan(100);
            expect(
                Object.keys(counts['mock-call-index'] ?? {}).length
            ).toBeGreaterThan(100);
            expect(Object.keys(baseline)).toEqual(
                expect.arrayContaining([
                    'non-null-assertion',
                    'mock-call-index',
                ])
            );
        },
        SCAN_TIMEOUT_MS
    );
});

describe('code rules: baseline file', () => {
    it('is sorted and formatted exactly as the tool writes it', () => {
        const text = readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8');
        expect(text).toBe(serializeBaseline(parseBaseline(text)));
    });

    it('only holds ratchet rules, with positive integer counts', () => {
        const ratchetKeys = CODE_RULES.filter(
            rule => rule.mode === 'ratchet'
        ).map(rule => rule.key);
        expect(
            Object.keys(liveBaseline()).every(key => ratchetKeys.includes(key))
        ).toBe(true);
    });

    it('rule keys are unique and do not look like document IDs', () => {
        expect(new Set(ruleKeys).size).toBe(ruleKeys.length);
        expect(ruleKeys.filter(key => /^[A-Z]{2}-\d+$/.test(key))).toEqual([]);
    });

    it('rejects a baseline with a non-positive count', () => {
        expect(() => parseBaseline('{"let-then-try":{"a.ts":0}}')).toThrow(
            'positive integer'
        );
    });
});

/** 심은 소스 하나를 스캔해 규칙 키별 위반 수를 돌려준다. */
const countOf = (key: string, file: string, text: string): number =>
    scanSources([{ path: file, text }]).counts[key]?.[file] ?? 0;

const TEST_PATH = 'src/shared/lib/__tests__/planted.test.ts';
const PROD_PATH = 'src/shared/lib/planted.ts';

describe('code rules: planted predicates', () => {
    describe('mock-call-index', () => {
        it.each([
            ['literal index then argument', 'fn.mock.calls[0][0];', 1],
            ['computed index', 'fn.mock.calls[i];', 1],
            ['at()', 'fn.mock.calls.at(-1);', 1],
            ['destructuring', 'const [[a]] = fn.mock.calls;', 1],
            [
                'toHaveBeenNthCalledWith',
                'expect(f).toHaveBeenNthCalledWith(2, x);',
                1,
            ],
            [
                'toHaveBeenNthReturnedWith',
                'expect(f).toHaveBeenNthReturnedWith(1, x);',
                1,
            ],
            ['cast around calls', '(fn.mock.calls as unknown[][])[0];', 1],
            ['optional chain', 'fn.mock?.calls[0];', 1],
            ['find by argument', "fn.mock.calls.find(([k]) => k === 'a');", 0],
            ['length', 'fn.mock.calls.length;', 0],
            ['toHaveBeenCalledWith', 'expect(f).toHaveBeenCalledWith(1);', 0],
            ['text in a string', "const s = 'fn.mock.calls[0]';", 0],
            ['text in a comment', '// fn.mock.calls[0]\nconst a = 1;', 0],
        ])('%s: %s -> %i', (_name, text, expected) => {
            expect(countOf('mock-call-index', TEST_PATH, text)).toBe(expected);
        });

        it('does not apply to production files', () => {
            expect(
                countOf('mock-call-index', PROD_PATH, 'fn.mock.calls[0];')
            ).toBe(0);
        });

        it('counts every occurrence in a file', () => {
            expect(
                countOf(
                    'mock-call-index',
                    TEST_PATH,
                    'fn.mock.calls[0];\nfn.mock.calls[1];\nfn.mock.calls.at(0);'
                )
            ).toBe(3);
        });
    });

    describe('non-null-assertion', () => {
        it.each([
            ['postfix bang', 'const a = x!;', 1],
            ['member bang', 'const a = x.y!.z;', 1],
            ['definite assignment', 'let y!: string;', 0],
            ['plain code', 'const a = x ?? 1;', 0],
        ])('%s: %s -> %i', (_name, text, expected) => {
            expect(countOf('non-null-assertion', TEST_PATH, text)).toBe(
                expected
            );
        });

        it('does not apply to production files (lint covers them)', () => {
            expect(
                countOf('non-null-assertion', PROD_PATH, 'const a = x!;')
            ).toBe(0);
        });
    });

    describe('let-then-if', () => {
        it.each([
            ['single assignment', 'let x = a;\nif (c) x = b;', 1],
            ['braced single assignment', 'let x = a;\nif (c) { x = b; }', 1],
            ['else branch', 'let x = a;\nif (c) x = b; else x = d;', 1],
            [
                'else-if chain',
                'let x = a;\nif (c) x = b; else if (d) x = e; else x = f;',
                1,
            ],
            [
                'inside a function',
                'function f() {\n let x = a;\n if (c) x = b;\n return x;\n}',
                1,
            ],
            [
                'inside a switch case',
                'switch (k) { case 1: let x = a; if (c) x = b; break; }',
                1,
            ],
            [
                'branch does more than assign',
                'let x = a;\nif (c) { x = b; log(); }',
                0,
            ],
            [
                'else does more than assign',
                'let x = a;\nif (c) x = b; else log();',
                0,
            ],
            ['other variable assigned', 'let x = a;\nif (c) y = b;', 0],
            ['compound assignment', 'let x = a;\nif (c) x *= 2;', 0],
            ['not adjacent', 'let x = a;\nlog();\nif (c) x = b;', 0],
            ['no initialiser', 'let x;\nif (c) x = b;', 0],
            ['const', 'const x = a;\nif (c) log();', 0],
            ['several declarators', 'let x = a, y = b;\nif (c) x = b;', 0],
        ])('%s -> %i', (_name, text, expected) => {
            expect(countOf('let-then-if', PROD_PATH, text)).toBe(expected);
        });

        it('applies to test files too', () => {
            expect(
                countOf('let-then-if', TEST_PATH, 'let x = a;\nif (c) x = b;')
            ).toBe(1);
        });
    });

    describe('let-then-try', () => {
        it.each([
            [
                'assigned in try',
                'let x;\ntry { x = f(); } catch { x = null; }',
                1,
            ],
            [
                'typed without initialiser',
                'let x: string | null;\ntry { x = f(); } catch { x = null; }',
                1,
            ],
            [
                'assigned in a nested block',
                'let x;\ntry { if (c) { x = f(); } } catch {}',
                1,
            ],
            [
                'two declarators, one assigned',
                'let a, b;\ntry { a = f(); } catch {}',
                1,
            ],
            ['initialised', 'let x = null;\ntry { x = f(); } catch {}', 0],
            ['only read in try', 'let x;\ntry { g(x); } catch {}', 0],
            [
                'only assigned in catch',
                'let x;\ntry { f(); } catch { x = 1; }',
                0,
            ],
            ['not adjacent', 'let x;\nlog();\ntry { x = f(); } catch {}', 0],
        ])('%s -> %i', (_name, text, expected) => {
            expect(countOf('let-then-try', PROD_PATH, text)).toBe(expected);
        });
    });

    it('classifies test files by path', () => {
        expect(
            [
                'src/a/__tests__/x.ts',
                'src/a/x.test.tsx',
                'src/__integration__/x.ts',
                'src/shared/test-utils/x.ts',
                'e2e/x.spec.ts',
                'cache-handler/__tests__/x.mjs',
            ].every(isTestFile)
        ).toBe(true);
        expect(['src/a/x.ts', 'scripts/x.ts', 'db/x.ts'].some(isTestFile)).toBe(
            false
        );
    });
});

describe('code rules: engine sanity', () => {
    it('fails on a recoverable parse error in a candidate file', () => {
        const scan = scanSources([
            { path: PROD_PATH, text: 'let x = 1;\nlet x = 2;' },
        ]);
        expect(scan.problems).toEqual([`${PROD_PATH}: 1 parse error(s)`]);
    });

    it('fails on a parse error babel cannot recover from', () => {
        const scan = scanSources([{ path: PROD_PATH, text: 'const = ;' }]);
        expect(scan.problems).toHaveLength(1);
        expect(scan.problems[0]).toContain(`${PROD_PATH}: parse error:`);
    });

    it('reports a broken mock-call-index predicate via the text cross-check', () => {
        const broken: readonly CodeRule[] = CODE_RULES.map(rule =>
            rule.key === 'mock-call-index'
                ? { ...rule, countAt: () => 0 }
                : rule
        );
        const scan = scanSources(
            [{ path: TEST_PATH, text: 'fn.mock.calls[0];' }],
            broken
        );
        expect(scan.problems).toHaveLength(1);
        expect(scan.problems[0]).toContain('mock-call-index counted 0');
    });

    it('does not flag mock.calls text that is only in comments or strings', () => {
        const scan = scanSources([
            {
                path: TEST_PATH,
                text: "// fn.mock.calls[0]\nconst s = 'fn.mock.calls.at(0)';\nconst t = `fn.mock.calls[1]`;\n",
            },
        ]);
        expect(scan.problems).toEqual([]);
    });

    it('fails when too few files were scanned', () => {
        const few = checkScanFloor({
            counts: {},
            scanned: 10,
            paths: [],
            problems: [],
        });
        expect(few.problems[0]).toContain('only 10 files were scanned');
        expect(
            checkScanFloor({
                counts: {},
                scanned: MIN_SCANNED_FILES,
                paths: [],
                problems: [],
            }).problems
        ).toEqual([]);
    });
});

const counts = (value: RuleCounts): RuleCounts => value;
const present = (...files: string[]): ReadonlySet<string> => new Set(files);

describe('code rules: comparator', () => {
    it('a planted violation in a new file fails', () => {
        const scan = scanSources([
            {
                path: 'src/shared/lib/__tests__/brandNew.test.ts',
                text: 'const a = x!;',
            },
        ]);
        const comparison = compareToBaseline(
            scan.counts,
            liveBaseline(),
            new Set(scan.paths)
        );
        expect(comparison.regressions).toHaveLength(1);
        expect(comparison.regressions[0]).toMatchObject({
            file: 'src/shared/lib/__tests__/brandNew.test.ts',
            baseline: 0,
            current: 1,
        });
        expect(describeComparison(comparison)[0]).toContain(
            'CONVENTIONS.md#TS-1'
        );
    });

    it('one more violation in an existing baselined file fails', () => {
        const [file, recorded] = Object.entries(
            liveBaseline()['non-null-assertion'] ?? {}
        )[0] ?? ['', 0];
        const text = Array.from({ length: recorded + 1 }, () => 'x!;').join(
            '\n'
        );
        const scan = scanSources([{ path: file, text }]);
        const comparison = compareToBaseline(
            scan.counts,
            liveBaseline(),
            new Set(scan.paths)
        );
        expect(comparison.regressions).toMatchObject([
            { file, baseline: recorded, current: recorded + 1 },
        ]);
    });

    it('the same count as the baseline passes', () => {
        const comparison = compareToBaseline(
            counts({ 'mock-call-index': { 'a.test.ts': 2 } }),
            { 'mock-call-index': { 'a.test.ts': 2 } },
            present('a.test.ts')
        );
        expect(comparison).toEqual({
            regressions: [],
            stale: [],
            tightenable: [],
        });
    });

    it('a zero-tolerance rule fails on any violation, baselined or not', () => {
        const comparison = compareToBaseline(
            counts({ 'let-then-if': { 'a.ts': 1 } }),
            {},
            present('a.ts')
        );
        expect(comparison.regressions).toMatchObject([
            { file: 'a.ts', baseline: 0, current: 1 },
        ]);
        expect(describeComparison(comparison)[0]).toContain(
            'allows no violations'
        );
    });

    it('a baseline entry whose file is gone is stale', () => {
        const comparison = compareToBaseline(
            counts({}),
            { 'let-then-try': { 'gone.ts': 1 } },
            present()
        );
        expect(comparison.stale).toMatchObject([
            {
                rule: 'let-then-try',
                file: 'gone.ts',
                baseline: 1,
                reason: 'the file is gone',
            },
        ]);
        expect(describeComparison(comparison)[0]).toContain('--tighten');
    });

    it('an entry whose file exists but has no violations left passes and is tightenable', () => {
        const comparison = compareToBaseline(
            counts({}),
            { 'let-then-try': { 'fixed.ts': 1 } },
            present('fixed.ts')
        );
        expect(comparison.stale).toEqual([]);
        expect(comparison.regressions).toEqual([]);
        expect(describeComparison(comparison)).toEqual([]);
        expect(comparison.tightenable).toEqual([
            { rule: 'let-then-try', file: 'fixed.ts', baseline: 1, current: 0 },
        ]);
    });

    it('an unknown rule key or a zero-tolerance key in the baseline is stale', () => {
        const comparison = compareToBaseline(
            counts({}),
            {
                'no-such-rule': { 'a.ts': 1 },
                'let-then-if': { 'b.ts': 1 },
            },
            present('a.ts', 'b.ts')
        );
        expect(comparison.stale.map(entry => entry.reason)).toEqual([
            'unknown rule key',
            'rule is zero-tolerance and takes no baseline entries',
        ]);
    });

    it('a partial decrease passes and is listed as tightenable', () => {
        const comparison = compareToBaseline(
            counts({ 'mock-call-index': { 'a.test.ts': 1 } }),
            { 'mock-call-index': { 'a.test.ts': 3 } },
            present('a.test.ts')
        );
        expect(comparison.regressions).toEqual([]);
        expect(comparison.stale).toEqual([]);
        expect(comparison.tightenable).toEqual([
            {
                rule: 'mock-call-index',
                file: 'a.test.ts',
                baseline: 3,
                current: 1,
            },
        ]);
    });
});

describe('code rules: baseline operations', () => {
    const baseline: Baseline = {
        'mock-call-index': { 'a.test.ts': 3, 'b.test.ts': 2 },
        'let-then-try': { 'c.ts': 1 },
    };

    it('--tighten lowers, drops zero entries, and never raises or adds', () => {
        const next = tightenBaseline(
            counts({
                'mock-call-index': {
                    'a.test.ts': 1,
                    'b.test.ts': 9,
                    'new.test.ts': 4,
                },
                'non-null-assertion': { 'n.test.ts': 5 },
            }),
            baseline
        );
        expect(next).toEqual({
            'mock-call-index': { 'a.test.ts': 1, 'b.test.ts': 2 },
        });
    });

    it('--tighten of an already tight baseline changes nothing', () => {
        const next = tightenBaseline(counts(baseline), baseline);
        expect(serializeBaseline(next)).toBe(serializeBaseline(baseline));
    });

    it('--init records ratchet rules only', () => {
        const created = initialBaseline(
            counts({
                'mock-call-index': { 'a.test.ts': 2 },
                'let-then-if': { 'z.ts': 1 },
                'non-null-assertion': {},
            })
        );
        expect(created).toEqual({ 'mock-call-index': { 'a.test.ts': 2 } });
    });

    it('--move keeps the total', () => {
        const moved = moveBaselineEntry(
            counts({ 'mock-call-index': { 'new.test.ts': 3 } }),
            baseline,
            'a.test.ts',
            'new.test.ts',
            false
        );
        expect(moved).toEqual({
            ok: true,
            baseline: {
                'mock-call-index': { 'b.test.ts': 2, 'new.test.ts': 3 },
                'let-then-try': { 'c.ts': 1 },
            },
        });
    });

    it('--move refuses when the new path has more violations than recorded', () => {
        const moved = moveBaselineEntry(
            counts({ 'mock-call-index': { 'new.test.ts': 4 } }),
            baseline,
            'a.test.ts',
            'new.test.ts',
            false
        );
        expect(moved).toMatchObject({ ok: false });
        expect(moved.ok ? '' : moved.reason).toContain(
            'more than the 3 recorded'
        );
    });

    it('--move refuses when the old file still exists (a fixed file is not a move)', () => {
        const moved = moveBaselineEntry(
            counts({ 'mock-call-index': { 'new.test.ts': 1 } }),
            baseline,
            'a.test.ts',
            'new.test.ts',
            true
        );
        expect(moved).toMatchObject({ ok: false });
        expect(moved.ok ? '' : moved.reason).toContain('still exists');
    });

    it('--move refuses an old path without an entry and an occupied new path', () => {
        expect(
            moveBaselineEntry(counts({}), baseline, 'nope.ts', 'new.ts', false)
        ).toMatchObject({ ok: false });
        expect(
            moveBaselineEntry(
                counts({ 'mock-call-index': { 'b.test.ts': 1 } }),
                baseline,
                'a.test.ts',
                'b.test.ts',
                false
            )
        ).toMatchObject({ ok: false });
    });

    it('--move drops the entry when the moved file has no violations left', () => {
        const moved = moveBaselineEntry(
            counts({}),
            baseline,
            'c.ts',
            'd.ts',
            false
        );
        expect(moved).toEqual({
            ok: true,
            baseline: { 'mock-call-index': baseline['mock-call-index'] },
        });
    });

    it('serialises keys in sorted order with a trailing newline', () => {
        const text = serializeBaseline({
            'mock-call-index': { 'b.ts': 1, 'a.ts': 2 },
            'let-then-try': { 'c.ts': 1 },
        });
        expect(text).toBe(
            `${JSON.stringify(
                {
                    'let-then-try': { 'c.ts': 1 },
                    'mock-call-index': { 'a.ts': 2, 'b.ts': 1 },
                },
                null,
                4
            )}\n`
        );
    });
});

describe('code rules: --against comparison', () => {
    const ref: Baseline = {
        'mock-call-index': { 'a.test.ts': 2, 'b.test.ts': 4 },
    };
    const noRenames = new Map<string, string>();

    it('flags a raised count', () => {
        const { raised, added } = compareAgainst(
            ref,
            { 'mock-call-index': { 'a.test.ts': 3, 'b.test.ts': 4 } },
            noRenames
        );
        expect(raised).toEqual([
            { rule: 'mock-call-index', file: 'a.test.ts', from: 2, to: 3 },
        ]);
        expect(added).toEqual([]);
    });

    it('flags a new key that no rename explains', () => {
        const { added } = compareAgainst(
            ref,
            {
                'mock-call-index': {
                    'a.test.ts': 2,
                    'b.test.ts': 4,
                    'c.test.ts': 1,
                },
            },
            noRenames
        );
        expect(added).toEqual([
            { rule: 'mock-call-index', file: 'c.test.ts', count: 1 },
        ]);
    });

    it('does not pair a vanished entry with an unrelated new file, whatever its value', () => {
        const { raised, added } = compareAgainst(
            ref,
            { 'mock-call-index': { 'a.test.ts': 2, 'unrelated.test.ts': 4 } },
            noRenames
        );
        expect(raised).toEqual([]);
        expect(added).toEqual([
            { rule: 'mock-call-index', file: 'unrelated.test.ts', count: 4 },
        ]);
    });

    it('explains a new entry only when git paired exactly those paths', () => {
        const { added } = compareAgainst(
            ref,
            { 'mock-call-index': { 'a.test.ts': 2, 'renamed.test.ts': 4 } },
            new Map([['b.test.ts', 'renamed.test.ts']])
        );
        expect(added).toEqual([]);
    });

    it('a rename of a different file does not explain the new entry', () => {
        const { added } = compareAgainst(
            ref,
            { 'mock-call-index': { 'a.test.ts': 2, 'renamed.test.ts': 4 } },
            new Map([['a.test.ts', 'elsewhere.test.ts']])
        );
        expect(added).toEqual([
            { rule: 'mock-call-index', file: 'renamed.test.ts', count: 4 },
        ]);
    });

    it('flags a renamed entry whose count grew beyond the old one', () => {
        const { added } = compareAgainst(
            ref,
            { 'mock-call-index': { 'a.test.ts': 2, 'renamed.test.ts': 5 } },
            new Map([['b.test.ts', 'renamed.test.ts']])
        );
        expect(added).toEqual([
            { rule: 'mock-call-index', file: 'renamed.test.ts', count: 5 },
        ]);
    });

    it('flags a whole new rule key', () => {
        const { added } = compareAgainst(
            ref,
            { ...ref, 'non-null-assertion': { 'n.test.ts': 1 } },
            noRenames
        );
        expect(added).toEqual([
            { rule: 'non-null-assertion', file: 'n.test.ts', count: 1 },
        ]);
    });

    it('lowering counts and dropping entries is not flagged', () => {
        expect(
            compareAgainst(
                ref,
                { 'mock-call-index': { 'a.test.ts': 1 } },
                noRenames
            )
        ).toEqual({ raised: [], added: [] });
    });
});
