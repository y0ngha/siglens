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
import { shortVolumeCandidateDates } from '../../lib/finraSchedule';
import { addDays } from '../../lib/investorFlowsDates';

const NOW = new Date('2026-10-15T12:00:00Z');
/** Settlements inside the 75-day lookback other than the 10-15 one (08-14, 08-31, 09-15, 09-30). */
const STORED = ['2026-08-14', '2026-08-31', '2026-09-15', '2026-09-30'];
/** First day before the 90-day short-volume window (exclusive bound, like the ingest). */
const VOLUME_WINDOW_START = addDays(
    '2026-10-15',
    -SHORT_VOLUME_BACKFILL_DAYS - 1
);
/** Every window weekday through `latest` — "the store is caught up to `latest`". */
const storedThrough = (latest: string): string[] =>
    shortVolumeCandidateDates(VOLUME_WINDOW_START, latest);

function build(
    over: Partial<IngestFinraDeps> = {},
    state: {
        /** Store caught up through this day (every window weekday up to it). */
        latestVolume?: string | null;
        /** Explicit stored trade dates (overrides `latestVolume`). */
        haveVolume?: string[];
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
        volumeSince: [] as string[],
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
            listShortVolumeTradeDates: async since => {
                calls.volumeSince.push(since);
                return new Set(
                    state.haveVolume ??
                        (state.latestVolume
                            ? storedThrough(state.latestVolume)
                            : [])
                );
            },
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
        it('fetches the missing weekdays newest first, stores universe rows, skips missing days', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-12',
                    files: { 'v:2026-10-14': CNMS_SAMPLE },
                }
            );
            const result = await runFinraIngest(deps);
            expect(calls.volumeFetched).toEqual([
                '2026-10-15',
                '2026-10-14',
                '2026-10-13',
            ]);
            expect(calls.volumeSince).toEqual([
                addDays(VOLUME_WINDOW_START, 1),
            ]);
            expect(result.volumeFiles).toBe(1);
            expect(result.volumeRows).toBe(4);
            expect(
                (calls.volumeRows[0] as { symbol: string }[])
                    .map(r => r.symbol)
                    .sort()
            ).toEqual(['AAPL', 'BF.A', 'BF.B', 'MSFT']);
        });

        it('backfills 90 days on an empty table newest first, capped per run', async () => {
            const { deps, calls } = build();
            await runFinraIngest(deps);
            const window = storedThrough('2026-10-15');
            expect(calls.volumeFetched).toEqual(
                window.toReversed().slice(0, MAX_SHORT_VOLUME_FILES_PER_RUN)
            );
            expect(SHORT_VOLUME_BACKFILL_DAYS).toBe(90);
        });

        it('fills the older days a capped first run left, on the next run', async () => {
            const window = storedThrough('2026-10-15');
            const firstRun = window
                .toReversed()
                .slice(0, MAX_SHORT_VOLUME_FILES_PER_RUN);
            const { deps, calls } = build({}, { haveVolume: firstRun });
            await runFinraIngest(deps);
            expect(calls.volumeFetched).toEqual(
                window.filter(date => !firstRun.includes(date)).toReversed()
            );
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

        it('does not start the remaining holiday variants once the deadline passes (lease sizing assumes one file in flight)', async () => {
            let fetches = 0;
            const { deps, calls } = build(
                {
                    // the deadline passes during the first variant fetch
                    isDeadlineReached: () => fetches > 0,
                    finra: {
                        fetchCnmsShortVolumeText: async () => null,
                        fetchShortInterestText: async () => {
                            fetches += 1;
                            return null;
                        },
                    },
                },
                { latestVolume: '2026-10-15', haveInterest: STORED }
            );
            const result = await runFinraIngest(deps);
            expect(fetches).toBe(1);
            expect(calls.interestFetched).toEqual([]);
            expect(result.status).toBe('deadline');
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

        it('looks back a year when nothing is stored yet, newest settlement first', async () => {
            const { deps, calls } = build({}, { latestVolume: '2026-10-15' });
            await runFinraIngest(deps);
            // 8-file cap, newest settlements first (all absent in this fake → variants each)
            expect(calls.interestFetched.length).toBeGreaterThan(20);
            expect(calls.interestFetched[0]).toBe('2026-10-15');
            expect(
                calls.interestFetched.every(date => date > '2026-01-01')
            ).toBe(true);
        });

        it('a capped first backfill leaves the older settlements for the next run', async () => {
            const { deps, calls } = build(
                {},
                {
                    latestVolume: '2026-10-15',
                    haveInterest: ['2026-10-15', '2026-09-30', '2026-09-15'],
                }
            );
            await runFinraIngest(deps);
            expect(calls.interestFetched[0]).toBe('2026-08-31');
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

    describe('first data stored (drives the "collecting" notice)', () => {
        it('tells the caller once when the first volume file lands in an empty store', async () => {
            const onFirstDataStored = vi.fn();
            const { deps } = build({
                onFirstDataStored,
                // Serve the sample for whichever day is asked.
                finra: {
                    fetchCnmsShortVolumeText: async () => CNMS_SAMPLE,
                    fetchShortInterestText: async () => null,
                },
            });
            const result = await runFinraIngest(deps);
            expect(result.firstDataStored).toBe(true);
            expect(onFirstDataStored).toHaveBeenCalledTimes(1);
        });

        it('tells the caller when only the first short-interest file lands (volume already stored)', async () => {
            const onFirstDataStored = vi.fn();
            const { deps } = build(
                {
                    onFirstDataStored,
                    finra: {
                        fetchCnmsShortVolumeText: async () => null,
                        fetchShortInterestText: async () =>
                            SHORT_INTEREST_SAMPLE,
                    },
                },
                { latestVolume: '2026-10-15' }
            );
            const result = await runFinraIngest(deps);
            expect(result.interestFiles).toBeGreaterThan(0);
            expect(result.firstDataStored).toBe(true);
            expect(onFirstDataStored).toHaveBeenCalledTimes(1);
        });

        it('stays silent on a normal incremental run into a non-empty store', async () => {
            const onFirstDataStored = vi.fn();
            const { deps } = build(
                { onFirstDataStored },
                {
                    latestVolume: '2026-10-13',
                    haveInterest: [...STORED, '2026-10-15'],
                    files: { 'v:2026-10-14': CNMS_SAMPLE },
                }
            );
            const result = await runFinraIngest(deps);
            expect(result.volumeFiles).toBe(1);
            expect(result.firstDataStored).toBe(false);
            expect(onFirstDataStored).not.toHaveBeenCalled();
        });

        it('stays silent when an empty store receives nothing (FINRA had no file yet)', async () => {
            const onFirstDataStored = vi.fn();
            const { deps } = build({ onFirstDataStored });
            const result = await runFinraIngest(deps);
            expect(result.firstDataStored).toBe(false);
            expect(onFirstDataStored).not.toHaveBeenCalled();
        });

        it('stays silent when the flag is off', async () => {
            const onFirstDataStored = vi.fn();
            const { deps } = build({
                isEnabled: () => false,
                onFirstDataStored,
            });
            const result = await runFinraIngest(deps);
            expect(result.firstDataStored).toBe(false);
            expect(onFirstDataStored).not.toHaveBeenCalled();
        });
    });
});
