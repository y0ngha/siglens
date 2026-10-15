import { describe, expect, it, vi } from 'vitest';
import { INVESTOR_FLOWS_BASELINE_MIN_FILERS } from '../../../src/entities/investor-flows/lib/investorFlowsPolicy';
import {
    rebuildAggregates,
    type RebuildAggregatesDeps,
} from '../rebuildInvestorFlowsAggregates';

const TODAY = '2026-10-15'; // Q2 (06-30) complete, Q3 (09-30) in progress; positions floor = 2026-03-31

function build(
    cusipsByPeriod: Record<string, string[]>,
    filers: Record<string, number> = {}
) {
    const recomputes: { period: string; cusips: string[]; mode: string }[] = [];
    const resets: string[] = [];
    const deps: RebuildAggregatesDeps = {
        listPeriods: async () => Object.keys(cusipsByPeriod).sort(),
        listCusips: async (period, after, limit) =>
            (cusipsByPeriod[period] ?? [])
                .filter(c => c > after)
                .sort()
                .slice(0, limit),
        countProcessedFilersForPeriod: async p => filers[p] ?? 0,
        recomputeAggregates: async (period, cusips, mode) => {
            recomputes.push({ period, cusips: [...cusips], mode });
        },
        resetAggregateChanges: async period => {
            resets.push(period);
            return 3;
        },
        log: vi.fn(),
    };
    return { deps, recomputes, resets };
}

describe('rebuildAggregates', () => {
    it('recomputes every period oldest first, covering every cusip exactly once', async () => {
        const { deps, recomputes } = build({
            '2026-09-30': ['A', 'B', 'C'],
            '2026-06-30': ['A', 'B'],
        });
        await rebuildAggregates(deps, {
            today: TODAY,
            dryRun: false,
            chunkSize: 2,
        });
        expect(recomputes).toEqual([
            { period: '2026-06-30', cusips: ['A', 'B'], mode: 'none' },
            { period: '2026-09-30', cusips: ['A', 'B'], mode: 'none' },
            { period: '2026-09-30', cusips: ['C'], mode: 'none' },
        ]);
    });

    it('splits cusips into chunks of the requested size (keyset paging)', async () => {
        const many = Array.from({ length: 1201 }, (_, i) =>
            String(i).padStart(9, '0')
        );
        const { deps, recomputes } = build({ '2026-06-30': many });
        const result = await rebuildAggregates(deps, {
            today: TODAY,
            dryRun: false,
        });
        expect(recomputes.map(r => r.cusips.length)).toEqual([500, 500, 201]);
        expect(result.periods[0]).toMatchObject({ cusips: 1201, chunks: 3 });
    });

    describe('mode decision (the ingester’s rule: filer count, retention floor, complete vs in-progress)', () => {
        it('a quarter with a baseline: complete → complete, in-progress → panel', async () => {
            const { deps, recomputes } = build(
                { '2026-06-30': ['A'], '2026-09-30': ['A'] },
                {
                    '2026-03-31': INVESTOR_FLOWS_BASELINE_MIN_FILERS,
                    '2026-06-30': INVESTOR_FLOWS_BASELINE_MIN_FILERS,
                }
            );
            await rebuildAggregates(deps, { today: TODAY, dryRun: false });
            expect(recomputes.map(r => [r.period, r.mode])).toEqual([
                ['2026-06-30', 'complete'],
                ['2026-09-30', 'panel'],
            ]);
        });

        it('requires enough applied filers in the prior quarter', async () => {
            const { deps, recomputes } = build(
                { '2026-09-30': ['A'] },
                { '2026-06-30': INVESTOR_FLOWS_BASELINE_MIN_FILERS - 1 }
            );
            await rebuildAggregates(deps, { today: TODAY, dryRun: false });
            expect(recomputes[0]?.mode).toBe('none');
        });

        it('never uses a baseline when the prior quarter is below the positions retention floor', async () => {
            const { deps, recomputes } = build(
                { '2026-03-31': ['A'] },
                { '2025-12-31': 99_999 }
            );
            await rebuildAggregates(deps, { today: TODAY, dryRun: false });
            expect(recomputes[0]?.mode).toBe('none');
        });
    });

    describe('reset mode (baseline rule tightened)', () => {
        const periods = { '2026-06-30': ['A'], '2026-09-30': ['A'] };
        const filers = { '2026-03-31': INVESTOR_FLOWS_BASELINE_MIN_FILERS }; // only 06-30 keeps a baseline

        it('resets the change columns of quarters that no longer have a baseline, before recomputing them', async () => {
            const { deps, resets, recomputes } = build(periods, filers);
            const result = await rebuildAggregates(deps, {
                today: TODAY,
                dryRun: false,
                reset: true,
            });
            expect(resets).toEqual(['2026-09-30']);
            expect(recomputes.find(r => r.period === '2026-09-30')?.mode).toBe(
                'none'
            );
            expect(
                result.periods.find(p => p.period === '2026-09-30')?.reset
            ).toBe(3);
        });

        it('never resets a quarter that still has a baseline', async () => {
            const { deps, resets } = build(periods, filers);
            await rebuildAggregates(deps, {
                today: TODAY,
                dryRun: false,
                reset: true,
            });
            expect(resets).not.toContain('2026-06-30');
        });

        it('does nothing destructive unless reset is requested', async () => {
            const { deps, resets } = build(periods, filers);
            await rebuildAggregates(deps, { today: TODAY, dryRun: false });
            expect(resets).toEqual([]);
        });

        it('a dry run never resets', async () => {
            const { deps, resets } = build(periods, filers);
            await rebuildAggregates(deps, {
                today: TODAY,
                dryRun: true,
                reset: true,
            });
            expect(resets).toEqual([]);
        });
    });

    describe('dry run', () => {
        it('plans every period but recomputes nothing', async () => {
            const { deps, recomputes } = build({ '2026-06-30': ['A', 'B'] });
            const result = await rebuildAggregates(deps, {
                today: TODAY,
                dryRun: true,
                chunkSize: 1,
            });
            expect(recomputes).toEqual([]);
            expect(result).toMatchObject({
                dryRun: true,
                periods: [{ period: '2026-06-30', cusips: 2, chunks: 2 }],
            });
        });
    });

    it('logs one line per period with its mode', async () => {
        const { deps } = build({ '2026-06-30': ['A'] });
        await rebuildAggregates(deps, { today: TODAY, dryRun: false });
        expect(deps.log).toHaveBeenCalledWith(
            '2026-06-30: 1 cusips in 1 chunk(s), mode=none'
        );
    });

    it('handles a database with no periods', async () => {
        const { deps, recomputes } = build({});
        expect(
            (await rebuildAggregates(deps, { today: TODAY, dryRun: false }))
                .periods
        ).toEqual([]);
        expect(recomputes).toEqual([]);
    });
});
