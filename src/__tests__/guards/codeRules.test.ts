import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    ALLOWED_LINT_DISABLE_FILES,
    CODE_RULES,
    MIN_SCANNED_FILES,
    checkScanFloor,
    isTestFile,
    issueRefLinesOf,
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
        'scans root configs, infra scripts and stylesheets as well as src',
        () => {
            const { paths } = liveScan();
            expect(paths).toEqual(
                expect.arrayContaining([
                    'next.config.ts',
                    'src/app/globals.css',
                    'src/shared/lib/withConcurrencyLimit.ts',
                ])
            );
            expect(paths.some(file => file.startsWith('infra/'))).toBe(true);
            expect(paths.some(file => file.endsWith('.sh'))).toBe(true);
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
            // 개수만으로는 어느 줄인지 모르므로 이슈·PR 번호 규칙은 파일의 모든 참조를 file:line으로 덧붙인다.
            const issueRefLines = comparison.regressions
                .filter(({ rule }) => rule.key === 'issue-ref-in-comment')
                .flatMap(({ file }) =>
                    issueRefLinesOf(
                        file,
                        readFileSync(path.join(ROOT, file), 'utf8')
                    ).map(line => `${file}:${line} cites an issue/PR number`)
                );
            expect([
                ...describeComparison(comparison),
                ...issueRefLines,
            ]).toEqual([]);
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

    describe('accumulator-in-loop', () => {
        const PURE = 'src/shared/lib/planted.ts';
        const NOTE =
            '// CONVENTIONS.md#CP-6 예외: 입력이 수십 개라 복사 비용이 없다';
        it.each([
            [
                'push in a for-of',
                'export function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}',
                1,
            ],
            [
                'push in a while loop',
                'export function f() {\n const out = [];\n while (go()) { out.push(1); }\n return out;\n}',
                1,
            ],
            [
                'push in a forEach callback',
                'export function f(xs: number[]) {\n const out: number[] = [];\n xs.forEach(x => out.push(x));\n return out;\n}',
                1,
            ],
            [
                'push on a member of a local',
                'export function f(xs: number[]) {\n const acc = { list: [] as number[] };\n for (const x of xs) acc.list.push(x);\n return acc;\n}',
                1,
            ],
            [
                'Map#set on a local map in a for-of',
                'export function f(xs: string[]) {\n const m = new Map<string, number>();\n for (const x of xs) m.set(x, 1);\n return m;\n}',
                1,
            ],
            [
                'Set#add on a local set in a for-of',
                'export function f(xs: string[]) {\n const s = new Set<string>();\n for (const x of xs) s.add(x);\n return s;\n}',
                1,
            ],
            [
                'push in a closure called from a loop body',
                'export function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) { const add = () => out.push(x); add(); }\n return out;\n}',
                1,
            ],
            [
                'a note above the function',
                `${NOTE}\nexport function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}`,
                0,
            ],
            [
                'a note above the loop',
                `export function f(xs: number[]) {\n const out: number[] = [];\n ${NOTE}\n for (const x of xs) out.push(x);\n return out;\n}`,
                0,
            ],
            [
                'a note above the accumulator',
                `export function f(xs: number[]) {\n ${NOTE}\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}`,
                0,
            ],
            [
                'a note opening the function body',
                `export function f(xs: number[]) {\n ${NOTE}\n log();\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}`,
                0,
            ],
            [
                'a note above a forEach statement',
                `export function f(xs: number[]) {\n const out: number[] = [];\n ${NOTE}\n xs.forEach(x => out.push(x));\n return out;\n}`,
                0,
            ],
            [
                'a marker without a reason',
                '// CONVENTIONS.md#CP-6 예외:\nexport function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}',
                1,
            ],
            [
                'a reason that names no cost',
                '// CONVENTIONS.md#CP-6 예외: 입력이 아주 작아서 그냥 이렇게 쓴다\nexport function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}',
                1,
            ],
            [
                'a reason that names a copy cost in English',
                '// CONVENTIONS.md#CP-6 예외: spreading would copy the array per element\nexport function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}',
                0,
            ],
            [
                'a reason that names an allocation cost',
                '// CONVENTIONS.md#CP-6 예외: 행마다 새 배열 할당이 겹친다\nexport function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}',
                0,
            ],
            [
                'a note about something else',
                '// 입력을 한 번에 훑는다\nexport function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}',
                1,
            ],
            [
                'a module-level cache written in a loop',
                'const cache: number[] = [];\nexport function f(xs: number[]) {\n for (const x of xs) cache.push(x);\n}',
                0,
            ],
            [
                'a parameter written in a loop',
                'export function f(out: number[], xs: number[]) {\n for (const x of xs) out.push(x);\n}',
                0,
            ],
            [
                'a fresh array per iteration',
                'export function f(xs: number[][]) {\n return xs.map(x => { const row: number[] = []; for (const y of x) row.push(y); return row; });\n}',
                1,
            ],
            [
                'an array declared inside the loop body',
                'export function f(xs: number[]) {\n for (const x of xs) { const row: number[] = []; row.push(x); use(row); }\n}',
                0,
            ],
            [
                'a push outside any loop',
                'export function f() {\n const out: number[] = [];\n out.push(1);\n return out;\n}',
                0,
            ],
            [
                'set on something that is not a Map',
                'export function f(xs: number[]) {\n const o = makeThing();\n for (const x of xs) o.set(x);\n}',
                0,
            ],
            [
                'a closure that is not called in a loop',
                'export function f() {\n const out: number[] = [];\n const add = (x: number) => out.push(x);\n return add;\n}',
                0,
            ],
        ])('%s -> %i', (_name, text, expected) => {
            expect(countOf('accumulator-in-loop', PURE, text)).toBe(expected);
        });

        it('counts every unannotated site in a file', () => {
            expect(
                countOf(
                    'accumulator-in-loop',
                    PURE,
                    'export function f(xs: number[]) {\n const a = [];\n const m = new Map();\n for (const x of xs) { a.push(x); m.set(x, 1); }\n}'
                )
            ).toBe(2);
        });

        it.each([
            ['src/entities/ticker/lib/x.ts', 1],
            ['src/shared/lib/sse/x.ts', 1],
            ['src/app/x.ts', 0],
            ['src/entities/ticker/model.ts', 0],
            ['src/widgets/chart/utils/x.ts', 0],
            ['scripts/x.ts', 0],
            ['src/shared/lib/__tests__/x.test.ts', 0],
        ])('applies by path: %s -> %i', (file, expected) => {
            expect(
                countOf(
                    'accumulator-in-loop',
                    file,
                    'export function f(xs: number[]) {\n const out: number[] = [];\n for (const x of xs) out.push(x);\n return out;\n}'
                )
            ).toBe(expected);
        });
    });

    describe('push-in-functional-callback', () => {
        it.each([
            ['map', 'xs.map(x => { out.push(x); return x; });', 1],
            ['filter', 'xs.filter(x => out.push(x) > 0);', 1],
            [
                'reduce',
                'xs.reduce((acc, x) => { acc.push(x); return acc; }, []);',
                1,
            ],
            ['flatMap', 'xs.flatMap(x => { out.push(x); return []; });', 1],
            [
                'useMemo factory',
                'const v = useMemo(() => { const r = []; r.push(1); return r; }, []);',
                1,
            ],
            [
                'React.useMemo factory',
                'const v = React.useMemo(() => { const r = []; r.push(1); return r; }, []);',
                1,
            ],
            [
                'a nested function inside the callback',
                'xs.map(x => { const add = () => out.push(x); add(); return x; });',
                1,
            ],
            ['a plain for loop', 'for (const x of xs) out.push(x);', 0],
            [
                'a forEach callback (the loop rule covers it)',
                'xs.forEach(x => out.push(x));',
                0,
            ],
            ['after the callback', 'xs.map(x => x);\nout.push(1);', 0],
            [
                'a callback argument that is not functional',
                'run(() => out.push(1));',
                0,
            ],
            ['a map callback without push', 'xs.map(x => x * 2);', 0],
        ])('%s -> %i', (_name, text, expected) => {
            expect(
                countOf('push-in-functional-callback', 'src/app/x.ts', text)
            ).toBe(expected);
        });

        it('does not apply to test files', () => {
            expect(
                countOf(
                    'push-in-functional-callback',
                    TEST_PATH,
                    'xs.map(x => { out.push(x); return x; });'
                )
            ).toBe(0);
        });

        it('applies to scripts and .mjs files', () => {
            expect(
                countOf(
                    'push-in-functional-callback',
                    'scripts/x.mjs',
                    'xs.map(x => { out.push(x); return x; });'
                )
            ).toBe(1);
        });
    });

    describe('logical-assignment-in-react', () => {
        it.each([
            [
                '??= in a component',
                'src/widgets/a/Foo.tsx',
                'ref.current ??= 1;',
                1,
            ],
            [
                '||= in a component',
                'src/widgets/a/Foo.tsx',
                'let a = 0;\na ||= 1;',
                1,
            ],
            [
                '&&= in a component',
                'src/widgets/a/Foo.tsx',
                'let a = 0;\na &&= 1;',
                1,
            ],
            [
                '??= in a hook',
                'src/shared/hooks/useFoo.ts',
                'ref.current ??= 1;',
                1,
            ],
            [
                '??= in a plain module',
                'src/shared/lib/foo.ts',
                'ref.current ??= 1;',
                0,
            ],
            [
                '??= in a file that only starts with "use"',
                'src/shared/lib/useful.ts',
                'ref.current ??= 1;',
                0,
            ],
            [
                '??= in a component test',
                'src/widgets/a/Foo.test.tsx',
                'ref.current ??= 1;',
                0,
            ],
            [
                'explicit form',
                'src/widgets/a/Foo.tsx',
                'ref.current = ref.current ?? 1;',
                0,
            ],
            [
                'plain assignment',
                'src/widgets/a/Foo.tsx',
                'ref.current = 1;',
                0,
            ],
            [
                'text in a string',
                'src/widgets/a/Foo.tsx',
                "const s = 'a ??= b';",
                0,
            ],
        ])('%s -> %i', (_name, file, text, expected) => {
            expect(countOf('logical-assignment-in-react', file, text)).toBe(
                expected
            );
        });
    });

    describe('local-doc-citation', () => {
        it.each([
            [
                'a line comment',
                'src/a/x.ts',
                '// see docs/architecture/X.md\n',
                1,
            ],
            [
                'a block comment',
                'src/a/x.ts',
                '/** docs/reference/CRON.md */\n',
                1,
            ],
            [
                'a string literal',
                'src/a/x.ts',
                "const a = 'docs/architecture/X.md';",
                1,
            ],
            [
                'a template literal',
                'src/a/x.ts',
                'const a = `see docs/qa/E2E.md ${b}`;',
                1,
            ],
            [
                'JSX text',
                'src/a/X.tsx',
                'const a = <p>docs/superpowers/plans/x.md</p>;',
                1,
            ],
            [
                'two citations in one comment',
                'src/a/x.ts',
                '// docs/qa/A.md and docs/qa/B.md\n',
                2,
            ],
            [
                'an agents-only folder',
                'src/a/x.ts',
                '// docs/__agents_only__/x.md\n',
                1,
            ],
            [
                'a framework URL',
                'src/a/x.ts',
                '// https://nextjs.org/docs/app/guides\n',
                0,
            ],
            [
                'a relative path',
                'src/a/x.ts',
                '// ../../docs/architecture/X.md\n',
                0,
            ],
            [
                'the tracked conventions docs',
                'src/a/x.ts',
                '// docs/conventions/TESTING.md\n',
                0,
            ],
            [
                'the tracked product docs',
                'src/a/x.ts',
                '// docs/product/README.md\n',
                0,
            ],
            [
                'a word that ends in docs',
                'src/a/x.ts',
                '// mydocs/architecture\n',
                0,
            ],
            ['code with no citation', 'src/a/x.ts', 'const a = 1;', 0],
        ])('%s -> %i', (_name, file, text, expected) => {
            expect(countOf('local-doc-citation', file, text)).toBe(expected);
        });

        it('counts a comment in a test file but not a planted source string', () => {
            expect(
                countOf(
                    'local-doc-citation',
                    TEST_PATH,
                    "const planted = 'docs/architecture/X.md';\nconst t = `docs/qa/Y.md`;"
                )
            ).toBe(0);
            expect(
                countOf(
                    'local-doc-citation',
                    TEST_PATH,
                    '// docs/architecture/X.md\n'
                )
            ).toBe(1);
        });

        it.each([
            ['infra/aws/x.sh', '# see docs/reference/CRON.md\n', 1],
            ['src/app/x.css', '/* docs/superpowers/plans/x.md */\n', 1],
            ['infra/aws/x.sh', '# see docs/conventions/TESTING.md\n', 0],
        ])(
            'scans the whole body of a text file: %s -> %i',
            (file, text, expected) => {
                expect(countOf('local-doc-citation', file, text)).toBe(
                    expected
                );
            }
        );

        it('ignores files that are neither code nor a scanned text type', () => {
            expect(
                countOf('local-doc-citation', 'src/a/x.md', 'docs/qa/E2E.md')
            ).toBe(0);
        });
    });

    describe('issue-ref-in-comment', () => {
        const SRC = 'src/a/x.ts';
        it.each([
            ['a line comment', SRC, '// see #1234\nconst a = 1;', 1],
            [
                'a trailing line comment',
                SRC,
                'const a = 1; // fixed in #1234',
                1,
            ],
            ['a block comment', SRC, '/* regression of #1234 */\n', 1],
            [
                'a JSDoc',
                SRC,
                '/**\n * Added in PR #1234.\n */\nconst a = 1;',
                1,
            ],
            [
                'a JSX comment',
                'src/a/X.tsx',
                'const a = <p>{/* #1234 */}</p>;',
                1,
            ],
            ['a test file', 'src/a/x.test.ts', '// PR #951 CI\n', 1],
            ['a three-digit number', SRC, '// hotfix #801\n', 1],
            ['a cross-repo reference', SRC, '// siglens-core#252\n', 1],
            ['two in one comment', SRC, '// #1234 and #1235\n', 2],
            ['a string literal', SRC, "const a = '#1234';", 0],
            ['a template literal', SRC, 'const a = `PR #1234 ${b}`;', 0],
            ['JSX text', 'src/a/X.tsx', 'const a = <p>#1234</p>;', 0],
            [
                'a URL with the number',
                SRC,
                '// https://github.com/x/y/pull/1234\n',
                0,
            ],
            ['a URL anchor', SRC, '// https://x.dev/a#1234\n', 0],
            ['a hex colour with letters', SRC, '/* #1e1e1e */\n', 0],
            ['a hex colour with a trailing letter', SRC, '// #818cf8\n', 0],
            ['a repeated-digit colour', SRC, '// #000\n// #111111\n', 0],
            ['the React hydration error code', SRC, '// React #418\n', 0],
            [
                'the code with a hydration word',
                SRC,
                '// 하이드레이션 불일치(#418)\n',
                0,
            ],
            ['a bare 418 reference', SRC, '// fixed in #418\n', 1],
            ['another number next to React', SRC, '// React fix #419\n', 1],
            ['a digit-only colour (documented limit)', SRC, '// #123456\n', 1],
            ['an HTML entity', SRC, '// &#1234; entity\n', 0],
            ['a single-digit step', SRC, '// step #1\n', 0],
            ['a two-digit number', SRC, '// item #12\n', 0],
            ['a number without a hash', SRC, '// PR 1234\n', 0],
            ['a rule ID', SRC, '// CM-11 and TE-63\n', 0],
            ['outside src', 'scripts/x.ts', '// #1234\n', 0],
            ['a markdown file', 'src/a/x.md', '// #1234\n', 0],
        ])('%s -> %i', (_name, file, text, expected) => {
            expect(countOf('issue-ref-in-comment', file, text)).toBe(expected);
        });

        it('names the line of each reference', () => {
            expect(
                issueRefLinesOf(
                    'src/a/x.ts',
                    'const a = 1;\n/**\n * a\n * PR #1234\n */\n// x #4321\n'
                )
            ).toEqual([4, 6]);
        });
    });

    describe('lint-disable-directive', () => {
        const ALLOWED = 'src/app/global-error.tsx';
        it.each([
            [
                'a line comment',
                'src/a/x.ts',
                '// eslint-disable-next-line no-console\n',
                1,
            ],
            [
                'a trailing comment',
                'src/a/x.ts',
                'const a = 1; // eslint-disable-line foo\n',
                1,
            ],
            ['a block comment', 'src/a/x.ts', '/* oxlint-disable foo */\n', 1],
            [
                'an oxlint line comment',
                'src/a/x.ts',
                '// oxlint-disable-next-line foo\n',
                1,
            ],
            [
                'a reason outside the allowlist',
                'src/a/x.ts',
                '// eslint-disable-next-line foo -- 사유\n',
                1,
            ],
            [
                'a test file',
                'src/a/x.test.ts',
                '// eslint-disable-next-line foo\n',
                1,
            ],
            [
                'an allowlisted file without a reason',
                ALLOWED,
                '/* eslint-disable foo */\n',
                1,
            ],
            [
                'an allowlisted file with a reason',
                ALLOWED,
                '/* eslint-disable foo -- 사유\n * 설명 */\n',
                0,
            ],
            [
                "another tool's comment",
                'src/a/x.ts',
                '// react-doctor-disable-next-line foo\n',
                0,
            ],
            [
                'a sentence that mentions disabling',
                'src/a/x.ts',
                '// how to disable lint is documented elsewhere\n',
                0,
            ],
            [
                'text in a string',
                'src/a/x.ts',
                "const s = '// eslint-disable-next-line foo';",
                0,
            ],
        ])('%s -> %i', (_name, file, text, expected) => {
            expect(countOf('lint-disable-directive', file, text)).toBe(
                expected
            );
        });

        it('keeps the allowlist at two files that still carry a reasoned directive', () => {
            expect(ALLOWED_LINT_DISABLE_FILES).toHaveLength(2);
            ALLOWED_LINT_DISABLE_FILES.forEach(allowed => {
                const text = readFileSync(path.join(ROOT, allowed), 'utf8');
                expect(
                    /(?:eslint|oxlint)-disable/.test(text),
                    `${allowed} must still carry a directive`
                ).toBe(true);
                expect(
                    countOf('lint-disable-directive', allowed, text),
                    `${allowed} directive needs a "--" reason`
                ).toBe(0);
            });
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
