import { describe, expect, it, vi } from 'vitest';

import type { ScanResult } from '../../src/__tests__/guards/support/codeRules';
import {
    parseBaseline,
    serializeBaseline,
} from '../../src/__tests__/guards/support/codeRulesBaseline';
import {
    parseRatchetArgs,
    runRatchet,
    type RatchetDeps,
} from '../rule-ratchet';

const BASELINE_FILES = ['a.test.ts', 'b.test.ts', 'c.ts'];

const scanOf = (
    counts: ScanResult['counts'],
    problems: readonly string[] = [],
    paths: readonly string[] = BASELINE_FILES
): ScanResult => ({ counts, scanned: 6000, paths, problems });

const BASELINE = serializeBaseline({
    'mock-call-index': { 'a.test.ts': 3, 'b.test.ts': 2 },
    'let-then-try': { 'c.ts': 1 },
});

function depsOf(
    scan: ScanResult,
    baselineText: string | null,
    refText: string | null = null,
    options: {
        renames?: ReadonlyMap<string, string>;
        existing?: readonly string[];
    } = {}
): RatchetDeps & { scan: ReturnType<typeof vi.fn> } {
    return {
        scan: vi.fn(() => scan),
        readBaseline: () => baselineText,
        readRefBaseline: () => refText,
        readRenames: () => options.renames ?? new Map(),
        fileExists: file => (options.existing ?? []).includes(file),
    };
}

const SAME = scanOf({
    'mock-call-index': { 'a.test.ts': 3, 'b.test.ts': 2 },
    'let-then-try': { 'c.ts': 1 },
});

describe('parseRatchetArgs', () => {
    it('reads each command', () => {
        expect(parseRatchetArgs([])).toEqual({ kind: 'report' });
        expect(parseRatchetArgs(['--tighten'])).toEqual({ kind: 'tighten' });
        expect(parseRatchetArgs(['--init'])).toEqual({ kind: 'init' });
        expect(parseRatchetArgs(['--move', 'a.ts', 'b.ts'])).toEqual({
            kind: 'move',
            from: 'a.ts',
            to: 'b.ts',
        });
        expect(parseRatchetArgs(['--against', 'origin/master'])).toEqual({
            kind: 'against',
            ref: 'origin/master',
        });
    });

    it('rejects anything else, including flags that would raise a count', () => {
        expect(parseRatchetArgs(['--raise']).kind).toBe('usage');
        expect(parseRatchetArgs(['--update']).kind).toBe('usage');
        expect(parseRatchetArgs(['--move', 'a.ts']).kind).toBe('usage');
        expect(parseRatchetArgs(['--tighten', 'extra']).kind).toBe('usage');
        expect(parseRatchetArgs(['--against']).kind).toBe('usage');
    });
});

describe('runRatchet report', () => {
    it('exits 0 and writes nothing when the counts match the baseline', () => {
        const outcome = runRatchet({ kind: 'report' }, depsOf(SAME, BASELINE));
        expect(outcome.exitCode).toBe(0);
        expect(outcome.write).toBeUndefined();
        expect(outcome.output).toContain('mock-call-index [ratchet] 5');
    });

    it('exits 1 on an increase', () => {
        const outcome = runRatchet(
            { kind: 'report' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'a.test.ts': 4, 'b.test.ts': 2 },
                    'let-then-try': { 'c.ts': 1 },
                }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(1);
        expect(outcome.output).toContain('a.test.ts: mock-call-index 3 -> 4');
    });

    it('exits 1 on a new file with a violation', () => {
        const outcome = runRatchet(
            { kind: 'report' },
            depsOf(
                scanOf({
                    ...SAME.counts,
                    'non-null-assertion': { 'new.test.ts': 1 },
                }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(1);
        expect(outcome.output).toContain(
            'new.test.ts: non-null-assertion 0 -> 1'
        );
    });

    it('passes with a fixed file whose entry is now zero and lists it as tightenable', () => {
        const outcome = runRatchet(
            { kind: 'report' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'a.test.ts': 1, 'b.test.ts': 2 },
                }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(0);
        expect(outcome.output).toContain('c.ts: let-then-try 1 -> 0');
        expect(outcome.output).toContain('a.test.ts: mock-call-index 3 -> 1');
        expect(outcome.write).toBeUndefined();
    });

    it('fails on an entry whose file is gone', () => {
        const outcome = runRatchet(
            { kind: 'report' },
            depsOf(
                scanOf(
                    { 'mock-call-index': { 'a.test.ts': 3, 'b.test.ts': 2 } },
                    [],
                    ['a.test.ts', 'b.test.ts']
                ),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(1);
        expect(outcome.output).toContain(
            'stale baseline entry let-then-try = 1 (the file is gone)'
        );
    });

    it('passes with a partial decrease and lists it as tightenable', () => {
        const outcome = runRatchet(
            { kind: 'report' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'a.test.ts': 1, 'b.test.ts': 2 },
                    'let-then-try': { 'c.ts': 1 },
                }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(0);
        expect(outcome.output).toContain('tightenable');
    });

    it('fails on engine problems and refuses a missing baseline', () => {
        expect(
            runRatchet(
                { kind: 'report' },
                depsOf(scanOf({}, ['x.ts: 1 parse error(s)']), BASELINE)
            ).exitCode
        ).toBe(1);
        const missing = runRatchet({ kind: 'report' }, depsOf(SAME, null));
        expect(missing.exitCode).toBe(1);
        expect(missing.output).toContain('run --init once');
    });

    it('prints usage and exits 1 for a bad command', () => {
        const outcome = runRatchet(
            { kind: 'usage', message: 'usage: x' },
            depsOf(SAME, BASELINE)
        );
        expect(outcome).toEqual({ output: 'usage: x', exitCode: 1 });
    });
});

describe('runRatchet --tighten', () => {
    it('lowers counts and drops entries that reached zero', () => {
        const outcome = runRatchet(
            { kind: 'tighten' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'a.test.ts': 1, 'b.test.ts': 2 },
                }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(0);
        expect(parseBaseline(outcome.write ?? '')).toEqual({
            'mock-call-index': { 'a.test.ts': 1, 'b.test.ts': 2 },
        });
    });

    it('never raises a count or adds an entry, and still fails on the regression', () => {
        const outcome = runRatchet(
            { kind: 'tighten' },
            depsOf(
                scanOf({
                    'mock-call-index': {
                        'a.test.ts': 9,
                        'b.test.ts': 2,
                        'new.test.ts': 4,
                    },
                    'let-then-try': { 'c.ts': 1 },
                }),
                BASELINE
            )
        );
        expect(outcome.write).toBe(BASELINE);
        expect(outcome.exitCode).toBe(1);
    });

    it('says so when nothing changed', () => {
        const outcome = runRatchet({ kind: 'tighten' }, depsOf(SAME, BASELINE));
        expect(outcome.output).toContain('baseline already tight');
        expect(outcome.write).toBe(BASELINE);
    });
});

describe('runRatchet --init', () => {
    it('refuses when the baseline file exists, so no CLI path can raise a count', () => {
        const deps = depsOf(SAME, BASELINE);
        const outcome = runRatchet({ kind: 'init' }, deps);
        expect(outcome.exitCode).toBe(1);
        expect(outcome.write).toBeUndefined();
        expect(deps.scan).not.toHaveBeenCalled();
    });

    it('creates the baseline from the current counts when none exists', () => {
        const outcome = runRatchet(
            { kind: 'init' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'a.test.ts': 2 },
                    'let-then-if': { 'z.ts': 1 },
                }),
                null
            )
        );
        expect(outcome.exitCode).toBe(0);
        expect(parseBaseline(outcome.write ?? '')).toEqual({
            'mock-call-index': { 'a.test.ts': 2 },
        });
    });
});

describe('runRatchet --move', () => {
    it('moves the entry and keeps the total', () => {
        const outcome = runRatchet(
            { kind: 'move', from: 'a.test.ts', to: 'moved.test.ts' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'moved.test.ts': 3, 'b.test.ts': 2 },
                    'let-then-try': { 'c.ts': 1 },
                }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(0);
        expect(parseBaseline(outcome.write ?? '')).toEqual({
            'mock-call-index': { 'moved.test.ts': 3, 'b.test.ts': 2 },
            'let-then-try': { 'c.ts': 1 },
        });
    });

    it('refuses when the old file still exists', () => {
        const outcome = runRatchet(
            { kind: 'move', from: 'a.test.ts', to: 'moved.test.ts' },
            depsOf(
                scanOf({
                    'mock-call-index': { 'moved.test.ts': 3, 'b.test.ts': 2 },
                }),
                BASELINE,
                null,
                { existing: ['a.test.ts'] }
            )
        );
        expect(outcome.exitCode).toBe(1);
        expect(outcome.write).toBeUndefined();
        expect(outcome.output).toContain('still exists');
    });

    it('refuses when the new path has more violations than the old entry', () => {
        const outcome = runRatchet(
            { kind: 'move', from: 'a.test.ts', to: 'moved.test.ts' },
            depsOf(
                scanOf({ 'mock-call-index': { 'moved.test.ts': 4 } }),
                BASELINE
            )
        );
        expect(outcome.exitCode).toBe(1);
        expect(outcome.write).toBeUndefined();
        expect(outcome.output).toContain('refused');
    });
});

describe('runRatchet --against', () => {
    it('lists a raised count and a new key, and does not scan', () => {
        const raised = serializeBaseline({
            'mock-call-index': {
                'a.test.ts': 4,
                'b.test.ts': 2,
                'new.test.ts': 9,
            },
        });
        const deps = depsOf(SAME, raised, BASELINE);
        const outcome = runRatchet(
            { kind: 'against', ref: 'origin/master' },
            deps
        );
        expect(outcome.exitCode).toBe(1);
        expect(outcome.output).toContain(
            'RAISED mock-call-index a.test.ts: 3 -> 4'
        );
        expect(outcome.output).toContain('NEW mock-call-index new.test.ts: 9');
        expect(outcome.output).toContain("user's approval");
        expect(deps.scan).not.toHaveBeenCalled();
    });

    it('uses git renames to explain a new key', () => {
        const renamed = serializeBaseline({
            'mock-call-index': { 'renamed.test.ts': 3, 'b.test.ts': 2 },
            'let-then-try': { 'c.ts': 1 },
        });
        const explained = runRatchet(
            { kind: 'against', ref: 'origin/master' },
            depsOf(SAME, renamed, BASELINE, {
                renames: new Map([['a.test.ts', 'renamed.test.ts']]),
            })
        );
        expect(explained.exitCode).toBe(0);
        const unexplained = runRatchet(
            { kind: 'against', ref: 'origin/master' },
            depsOf(SAME, renamed, BASELINE)
        );
        expect(unexplained.exitCode).toBe(1);
        expect(unexplained.output).toContain(
            'NEW mock-call-index renamed.test.ts: 3 (not explained by a git rename)'
        );
    });

    it('passes when the baseline only went down', () => {
        const lower = serializeBaseline({
            'mock-call-index': { 'a.test.ts': 1 },
        });
        const outcome = runRatchet(
            { kind: 'against', ref: 'origin/master' },
            depsOf(SAME, lower, BASELINE)
        );
        expect(outcome.exitCode).toBe(0);
    });

    it('passes when the ref has no baseline yet (first introduction)', () => {
        const outcome = runRatchet(
            { kind: 'against', ref: 'origin/master' },
            depsOf(SAME, BASELINE, null)
        );
        expect(outcome.exitCode).toBe(0);
        expect(outcome.output).toContain('first introduction');
    });
});
