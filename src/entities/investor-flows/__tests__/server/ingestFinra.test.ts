import { describe, expect, it, vi } from 'vitest';
import {
    MAX_SHORT_VOLUME_FILES_PER_RUN,
    runFinraIngest,
    SHORT_VOLUME_BACKFILL_DAYS,
    type IngestFinraDeps,
} from '../../server/ingestFinra';
import {
    CNMS_SAMPLE,
    SHORT_INTEREST_SAMPLE,
} from '../fixtures/investorFlowsSamples';

const NOW = new Date('2026-10-15T12:00:00Z');
/** Settlements inside the 75-day lookback other than the 10-15 one (08-14, 08-31, 09-15, 09-30). */
const STORED = ['2026-08-14', '2026-08-31', '2026-09-15', '2026-09-30'];

function build(
    over: Partial<IngestFinraDeps> = {},
    state: {
        latestVolume?: string | null;
        haveInterest?: string[];
        files?: Record<string, string>;
    } = {}
) {
    const calls = {
        volumeFetched: [] as string[],
        interestFetched: [] as string[],
        volumeRows: [] as unknown[][],
        interestRows: [] as unknown[][],
        universeLoads: 0,
        prunes: [] as string[],
        invalidated: [] as string[][],
    };
    const deps: IngestFinraDeps = {
        isEnabled: () => true,
        loadUniverseSymbols: async () => {
            calls.universeLoads += 1;
            return ['AAPL', 'MSFT', 'BF.A', 'BF.B'];
        },
        finra: {
            fetchCnmsShortVolumeText: async date => {
                calls.volumeFetched.push(date);
                return state.files?.[`v:${date}`] ?? null;
            },
            fetchShortInterestText: async date => {
                calls.interestFetched.push(date);
                return state.files?.[`i:${date}`] ?? null;
            },
        },
        repo: {
            latestShortVolumeDate: async () => state.latestVolume ?? null,
            listShortInterestSettlementDates: async () =>
                new Set(state.haveInterest ?? []),
            upsertShortVolume: async rows => {
                calls.volumeRows.push([...rows]);
            },
            upsertShortInterest: async rows => {
                calls.interestRows.push([...rows]);
            },
            pruneShortVolumeBefore: async d => {
                calls.prunes.push(`volume<${d}`);
                return 0;
            },
            pruneShortInterestBefore: async d => {
                calls.prunes.push(`interest<${d}`);
                return 0;
            },
        },
        invalidateSymbols: symbols => {
            calls.invalidated.push([...symbols]);
        },
        now: () => NOW,
        isDeadlineReached: () => false,
        log: vi.fn(),
        ...over,
    };
    return { deps, calls };
}

describe('runFinraIngest', () => {
    describe('when FINRA_SHORT_DATA_ENABLED is off', () => {
        it('returns disabled with zero HTTP requests, zero DB access and no universe load', async () => {
            const { deps, calls } = build({ isEnabled: () => false });
            const result = await runFinraIngest(deps);
            expect(result).toMatchObject({
                status: 'disabled',
                volumeFiles: 0,
                interestFiles: 0,
            });
            expect(calls.volumeFetched).toEqual([]);
            expect(calls.interestFetched).toEqual([]);
            expect(calls.universeLoads).toBe(0);
            expect(calls.prunes).toEqual([]);
        });
    });

    describe('daily short volume', () => {
        it('fetches weekdays after the last stored date, stores universe rows, skips missing days', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-12',
                    files: { 'v:2026-10-14': CNMS_SAMPLE },
                }
            );
            const result = await runFinraIngest(deps);
            expect(calls.volumeFetched).toEqual([
                '2026-10-13',
                '2026-10-14',
                '2026-10-15',
            ]);
            expect(result.volumeFiles).toBe(1);
            expect(result.volumeRows).toBe(4);
            expect(
                (calls.volumeRows[0] as { symbol: string }[])
                    .map(r => r.symbol)
                    .sort()
            ).toEqual(['AAPL', 'BF.A', 'BF.B', 'MSFT']);
        });

        it('backfills 90 days on an empty table, capped per run', async () => {
            const { deps, calls } = build();
            await runFinraIngest(deps);
            expect(calls.volumeFetched).toHaveLength(
                MAX_SHORT_VOLUME_FILES_PER_RUN
            );
            expect((calls.volumeFetched[0] as string) >= '2026-07-17').toBe(
                true
            );
            expect(SHORT_VOLUME_BACKFILL_DAYS).toBe(90);
        });
    });

    describe('short interest', () => {
        it('tries holiday variants in order and stops at the first file that exists', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: STORED,
                    files: { 'i:2026-10-15': SHORT_INTEREST_SAMPLE },
                }
            );
            const result = await runFinraIngest(deps);
            expect(calls.interestFetched).toEqual(['2026-10-15']);
            expect(result.interestFiles).toBe(1);
            expect(result.interestRows).toBe(4);
        });

        it('falls back to the previous weekday when the nominal settlement file is absent', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: STORED,
                    files: { 'i:2026-10-14': SHORT_INTEREST_SAMPLE },
                }
            );
            await runFinraIngest(deps);
            expect(calls.interestFetched).toEqual(['2026-10-15', '2026-10-14']);
        });

        it('does not refetch settlements already stored', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: [...STORED, '2026-10-15'],
                }
            );
            await runFinraIngest(deps);
            expect(calls.interestFetched).toEqual([]);
        });

        it('treats a stored variant date as the settlement being present', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: [...STORED, '2026-10-14'],
                }
            );
            await runFinraIngest(deps);
            expect(calls.interestFetched).toEqual([]);
        });

        it('looks back a year when nothing is stored yet', async () => {
            const { deps, calls } = build({}, { latestVolume: '2026-10-15' });
            await runFinraIngest(deps);
            // 8-file cap, oldest settlements first (all absent in this fake → 4 variants each)
            expect(calls.interestFetched.length).toBeGreaterThan(20);
            expect((calls.interestFetched[0] as string) < '2025-11-30').toBe(
                true
            );
        });
    });

    describe('universe and pruning', () => {
        it('does nothing for an empty universe', async () => {
            const { deps, calls } = build({
                loadUniverseSymbols: async () => [],
            });
            expect((await runFinraIngest(deps)).status).toBe('empty_universe');
            expect(calls.volumeFetched).toEqual([]);
        });

        it('prunes volume at 120 days and interest at 2 years', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: [...STORED, '2026-10-15'],
                }
            );
            await runFinraIngest(deps);
            expect(calls.prunes).toEqual([
                'volume<2026-06-17',
                'interest<2024-10-15',
            ]);
        });

        it('stops with deadline status and skips the interest phase', async () => {
            const { deps, calls } = build(
                { isDeadlineReached: () => true },
                { latestVolume: '2026-10-12' }
            );
            const result = await runFinraIngest(deps);
            expect(result.status).toBe('deadline');
            expect(calls.interestFetched).toEqual([]);
        });
    });

    describe('cache invalidation', () => {
        it('invalidates the symbols whose volume or interest rows were written (sorted, deduplicated)', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-13',
                    haveInterest: [...STORED, '2026-10-15'],
                    files: { 'v:2026-10-14': CNMS_SAMPLE },
                }
            );
            const result = await runFinraIngest(deps);
            expect(calls.invalidated).toEqual([
                ['AAPL', 'BF.A', 'BF.B', 'MSFT'],
            ]);
            expect(result.invalidated).toBe(4);
        });

        it('does not invalidate when nothing was ingested', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: [...STORED, '2026-10-15'],
                }
            );
            await runFinraIngest(deps);
            expect(calls.invalidated).toEqual([]);
        });

        it('does not invalidate anything when the flag is off', async () => {
            const { deps, calls } = build({ isEnabled: () => false });
            await runFinraIngest(deps);
            expect(calls.invalidated).toEqual([]);
        });
    });
});
