import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_BASELINE_MIN_FILERS,
    INVESTOR_FLOWS_MAX_REAPPLY,
    INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import type { AmendmentFiling } from '../../lib/amendmentPlan';
import {
    CURSOR_OVERLAP_DAYS,
    run13fIngest,
    type Ingest13fDeps,
    type Ingest13fRepository,
} from '../../server/ingest13f';
import type { AggregateMode } from '../../api/aggregateSql';
import type {
    ApplyFilingInput,
    DirtyBatch,
} from '../../api/investorFlows13fRepository';
import type { InvestorFlowsUniverse } from '../../api/investorFlowsUniverseRepository';
import type { FilingRecord } from '../../model';
import {
    FILING_INDEX_JSON,
    INFO_TABLE_SAMPLE,
    PRIMARY_DOC_NEW_HOLDINGS,
    PRIMARY_DOC_ORIGINAL,
    PRIMARY_DOC_RESTATEMENT,
} from '../fixtures/investorFlowsSamples';

const NOW = new Date('2026-10-15T12:00:00Z'); // Thursday; Q2 (06-30) is complete, Q3 (09-30) in progress
const ABBOTT = '002824100';
const MSFT = '594918104';
const NVDA = '67066G104';

const UNIVERSE: InvestorFlowsUniverse = {
    cusips: new Map([
        [ABBOTT, { id: 1, symbol: 'ABT' }],
        [MSFT, { id: 2, symbol: 'MSFT' }],
        [NVDA, { id: 3, symbol: 'NVDA' }],
    ]),
    symbols: ['ABT', 'MSFT', 'NVDA'],
    loadedAt: '2026-10-15 11:00:00+00',
};

const indexLine = (
    form: string,
    name: string,
    cik: string,
    date: string,
    accession: string
): string =>
    `${form.padEnd(16)} ${name.padEnd(60)} ${cik.padEnd(10)} ${date}    edgar/data/${Number(cik)}/${accession}.txt`;

const ORIGINAL_ACC = '0002085853-26-001185';
const ORIGINAL_LINE = indexLine(
    '13F-HR',
    '15 Wealth Advisors LLC',
    '2148692',
    '20261014',
    ORIGINAL_ACC
);

/** State that survives between runs (a real database does) — the dirty queue, pruning state, ledger. */
class FakeStore {
    dirty = new Map<string, Set<number>>(); // period -> cusip ids
    /** cusip-map's "full pass done" marker is set by default — the gate has its own tests. */
    state = new Map<string, string>([
        [INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE, '2026-10-10T00:00:00.000Z'],
    ]);
    /** filers applied per period (default 0). */
    filers: (period: string) => number = () => 0;
    exhausted = 0;
}

interface Scenario {
    days?: Record<string, string[]>;
    primaryDocs?: Record<string, string>;
    infoTables?: Record<string, string>;
    existing?: Record<string, FilingRecord>;
    processed?: AmendmentFiling[];
    /** positions already stored for the filer/period (ledger empty = a re-ingest). */
    positionsExist?: boolean;
    latestFilingDate?: string | null;
    pending?: {
        accession: string;
        cik: string;
        filingDate: string;
        submissionType: string;
    }[];
    store?: FakeStore;
    /** make recompute throw on the Nth call (1-based) */
    recomputeThrowsAt?: number;
    /** make the first applyFiling of this accession throw (simulates a crash/DB error between steps) */
    applyThrows?: string;
}

function build(scenario: Scenario = {}, over: Partial<Ingest13fDeps> = {}) {
    const store = scenario.store ?? new FakeStore();
    const calls = {
        indexDates: [] as string[],
        indexJson: [] as string[],
        primary: [] as string[],
        infoTable: [] as string[],
        applied: [] as ApplyFilingInput[],
        failures: [] as { accession: string; error: string }[],
        recomputes: [] as {
            period: string;
            cusips: string[];
            mode: AggregateMode;
        }[],
        cleared: [] as { period: string; ids: number[] }[],
        prunes: [] as string[],
        marked: [] as string[],
        invalidated: [] as string[][],
        order: [] as string[],
    };
    let recomputeCount = 0;
    const repo: Ingest13fRepository = {
        findFilings: async accessions =>
            new Map(
                accessions.flatMap(a =>
                    scenario.existing?.[a]
                        ? [[a, scenario.existing[a]] as const]
                        : []
                )
            ),
        latestFilingDate: async () => scenario.latestFilingDate ?? null,
        listPendingRetries: async () => scenario.pending ?? [],
        countExhaustedFailures: async () => store.exhausted,
        recordFailure: async (filing, error) => {
            calls.failures.push({ accession: filing.accession, error });
        },
        findProcessedFilings: async () => scenario.processed ?? [],
        hasPositions: async () => scenario.positionsExist ?? false,
        countProcessedFilersForPeriod: async period => store.filers(period),
        applyFiling: async input => {
            if (scenario.applyThrows === input.accession)
                throw new Error('crash in applyFiling');
            calls.applied.push(input);
            calls.order.push(`apply:${input.accession}:${input.mode}`);
            if (input.period !== null && input.mode !== 'skip') {
                const set = store.dirty.get(input.period) ?? new Set<number>();
                for (const row of input.rows) {
                    const id = input.cusipIds.get(row.cusip);
                    if (id !== undefined) set.add(id);
                }
                store.dirty.set(input.period, set);
            }
            return input.mode === 'skip' ? [] : input.rows.map(r => r.cusip);
        },
        takeDirty: async (): Promise<DirtyBatch | null> => {
            const period = [...store.dirty.keys()]
                .filter(p => (store.dirty.get(p)?.size ?? 0) > 0)
                .sort()[0];
            if (period === undefined) return null;
            const ids = [...(store.dirty.get(period) as Set<number>)];
            const byId = new Map(
                [...UNIVERSE.cusips].map(([cusip, v]) => [
                    v.id,
                    { cusip, symbol: v.symbol },
                ])
            );
            return {
                period,
                entries: ids.map(id => ({
                    id,
                    ...(byId.get(id) as { cusip: string; symbol: string }),
                })),
            };
        },
        clearDirty: async (period, ids) => {
            calls.order.push(`clear:${period}`);
            calls.cleared.push({ period, ids: [...ids] });
            for (const id of ids) store.dirty.get(period)?.delete(id);
        },
        recomputeAggregates: async (period, cusips, mode) => {
            recomputeCount += 1;
            if (scenario.recomputeThrowsAt === recomputeCount)
                throw new Error('crash in recompute');
            calls.order.push(`recompute:${period}:${mode}`);
            calls.recomputes.push({ period, cusips: [...cusips], mode });
        },
        markPeriodDirty: async period => {
            calls.marked.push(period);
            const set = store.dirty.get(period) ?? new Set<number>();
            for (const { id } of UNIVERSE.cusips.values()) set.add(id);
            store.dirty.set(period, set);
            return UNIVERSE.cusips.size;
        },
        prunePositionsBefore: async (floor, shouldStop) => {
            calls.prunes.push(`positions<${floor}`);
            return { deleted: shouldStop() ? 0 : 7, done: !shouldStop() };
        },
        pruneAggregatesBefore: async f => {
            calls.prunes.push(`aggregates<${f}`);
            return 0;
        },
        pruneFilingsBefore: async f => {
            calls.prunes.push(`filings<${f}`);
            return 0;
        },
        getState: async key => store.state.get(key) ?? null,
        setState: async (key, value) => {
            store.state.set(key, value);
        },
    };
    const deps: Ingest13fDeps = {
        sec: {
            fetchDailyFormIndex: async date => {
                calls.indexDates.push(date);
                const lines = scenario.days?.[date];
                return lines === undefined ? null : lines.join('\n');
            },
            fetchFilingIndexJson: async (_cik, accession) => {
                calls.indexJson.push(accession);
                return FILING_INDEX_JSON;
            },
            fetchFilingDocumentText: async (_cik, accession) => {
                calls.primary.push(accession);
                return (
                    scenario.primaryDocs?.[accession] ?? PRIMARY_DOC_ORIGINAL
                );
            },
            fetchFilingDocumentStream: async (_cik, accession) => {
                calls.infoTable.push(accession);
                const text =
                    scenario.infoTables?.[accession] ?? INFO_TABLE_SAMPLE;
                return (async function* () {
                    yield new TextEncoder().encode(text);
                })();
            },
        },
        repo,
        loadUniverse: async () => UNIVERSE,
        isSecBlockedError: error =>
            error instanceof Error && error.message === 'blocked',
        now: () => NOW,
        isDeadlineReached: () => false,
        invalidateSymbols: symbols => {
            calls.invalidated.push([...symbols]);
        },
        log: vi.fn(),
        ...over,
    };
    return { deps, calls, store };
}

const original = (over: Partial<Scenario> = {}): Scenario => ({
    days: { '2026-10-14': [ORIGINAL_LINE] },
    latestFilingDate: '2026-10-13',
    ...over,
});

describe('run13fIngest', () => {
    describe('happy path', () => {
        it('reads the daily index, applies a filing, recomputes from the dirty queue and then clears it', async () => {
            const { deps, calls, store } = build(original());
            const result = await run13fIngest(deps);

            expect(result).toMatchObject({
                stoppedBy: 'complete',
                filingsListed: 1,
                filingsProcessed: 1,
                filingsFailed: 0,
            });
            expect(calls.applied).toHaveLength(1);
            expect(calls.applied[0]).toMatchObject({
                accession: ORIGINAL_ACC,
                cik: '0002148692',
                filingDate: '2026-10-14',
                submissionType: '13F-HR',
                period: '2026-09-30',
                filerName: '15 Wealth Advisors LLC',
                mode: 'replace',
            });
            expect(calls.applied[0]?.rows.map(r => r.cusip).sort()).toEqual([
                ABBOTT,
                MSFT,
                NVDA,
            ]);
            expect(calls.recomputes.map(r => r.period)).toEqual(['2026-09-30']);
            expect(calls.recomputes[0]?.cusips.sort()).toEqual([
                ABBOTT,
                MSFT,
                NVDA,
            ]);
            expect([...(store.dirty.get('2026-09-30') ?? [])]).toEqual([]);
        });

        it('passes the universe cusip ids so positions are stored by id', async () => {
            const { deps, calls } = build(original());
            await run13fIngest(deps);
            expect([...(calls.applied[0]?.cusipIds ?? [])].sort()).toEqual([
                [ABBOTT, 1],
                [MSFT, 2],
                [NVDA, 3],
            ]);
        });

        it('aggregates duplicate rows of one filing into one position (MSFT 6795+5)', async () => {
            const { deps, calls } = build(original());
            await run13fIngest(deps);
            expect(calls.applied[0]?.rows.find(r => r.cusip === MSFT)).toEqual({
                cusip: MSFT,
                shares: 6800,
                valueUsd: 3487841,
            });
        });

        it('reports the symbols whose aggregates changed for cache invalidation', async () => {
            const { deps, calls } = build(original());
            const result = await run13fIngest(deps);
            expect(calls.invalidated).toHaveLength(1);
            expect(calls.invalidated[0]?.sort()).toEqual([
                'ABT',
                'MSFT',
                'NVDA',
            ]);
            expect(result.invalidated).toBe(3);
        });

        it('does not call invalidate when nothing changed', async () => {
            const { deps, calls } = build({
                days: {},
                latestFilingDate: '2026-10-13',
            });
            await run13fIngest(deps);
            expect(calls.invalidated).toEqual([]);
        });
    });

    describe('aggregate modes (period filer rule + complete vs in-progress)', () => {
        it('in-progress quarter with a baseline uses the panel comparison', async () => {
            const { deps, calls, store } = build(original());
            store.filers = p =>
                p === '2026-06-30' ? INVESTOR_FLOWS_BASELINE_MIN_FILERS : 0;
            await run13fIngest(deps);
            expect(
                calls.recomputes.find(r => r.period === '2026-09-30')?.mode
            ).toBe('panel');
        });

        it('a complete quarter with a baseline uses the full-vs-full comparison', async () => {
            const { deps, calls, store } = build(
                original({
                    primaryDocs: {
                        [ORIGINAL_ACC]: PRIMARY_DOC_ORIGINAL.replaceAll(
                            '09-30-2026',
                            '06-30-2026'
                        ),
                    },
                })
            );
            store.filers = p =>
                p === '2026-03-31' ? INVESTOR_FLOWS_BASELINE_MIN_FILERS : 0;
            await run13fIngest(deps);
            expect(
                calls.recomputes.find(r => r.period === '2026-06-30')?.mode
            ).toBe('complete');
        });

        it('requires at least 1,000 filers in the prior quarter to treat it as a baseline', async () => {
            const run = async (filers: number) => {
                const { deps, calls, store } = build(original());
                store.filers = p => (p === '2026-06-30' ? filers : 0);
                await run13fIngest(deps);
                return calls.recomputes.find(r => r.period === '2026-09-30')
                    ?.mode;
            };
            expect(await run(INVESTOR_FLOWS_BASELINE_MIN_FILERS - 1)).toBe(
                'none'
            );
            expect(await run(INVESTOR_FLOWS_BASELINE_MIN_FILERS)).toBe('panel');
        });

        it('never uses a baseline when the prior quarter is below the positions floor', async () => {
            const { deps, calls, store } = build(
                original({
                    primaryDocs: {
                        [ORIGINAL_ACC]: PRIMARY_DOC_ORIGINAL.replaceAll(
                            '09-30-2026',
                            '03-31-2026'
                        ),
                    },
                })
            );
            store.filers = () => 99_999;
            await run13fIngest(deps);
            expect(
                calls.recomputes.find(r => r.period === '2026-03-31')?.mode
            ).toBe('none');
        });

        it('also recomputes the next quarter when it already has applied filings', async () => {
            const { deps, calls, store } = build(
                original({
                    primaryDocs: {
                        [ORIGINAL_ACC]: PRIMARY_DOC_ORIGINAL.replaceAll(
                            '09-30-2026',
                            '06-30-2026'
                        ),
                    },
                })
            );
            store.filers = p =>
                p === '2026-06-30' || p === '2026-09-30' ? 5000 : 0;
            await run13fIngest(deps);
            expect(calls.recomputes.map(r => [r.period, r.mode])).toEqual([
                ['2026-06-30', 'none'],
                ['2026-09-30', 'panel'],
            ]);
        });
    });

    describe('mode transitions (a period’s computation mode changes over time)', () => {
        const KEY = (period: string) => `sec13f_period_mode:${period}`;
        const withBaseline = (store: FakeStore) => {
            // Q1 has plenty of filers => Q2 (complete) is `complete`, Q3 (in progress) is `panel`
            store.filers = p =>
                p === '2026-03-31' || p === '2026-06-30' ? 5000 : 0;
        };

        it('re-queues the WHOLE period when an in-progress (panel) quarter has become complete, and recomputes it as complete', async () => {
            const store = new FakeStore();
            withBaseline(store);
            store.state.set(KEY('2026-06-30'), 'panel'); // computed while it was still in progress
            store.state.set(KEY('2026-03-31'), 'none');
            store.state.set(KEY('2026-09-30'), 'panel');
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            await run13fIngest(deps);
            expect(calls.marked).toEqual(['2026-06-30']);
            expect(
                calls.recomputes
                    .filter(r => r.period === '2026-06-30')
                    .map(r => r.mode)
            ).toEqual(['complete']);
            expect(
                calls.recomputes
                    .find(r => r.period === '2026-06-30')
                    ?.cusips.sort()
            ).toEqual([ABBOTT, MSFT, NVDA]);
            expect(store.state.get(KEY('2026-06-30'))).toBe('complete');
        });

        it('does nothing when the stored mode already matches (no needless full-period recompute)', async () => {
            const store = new FakeStore();
            withBaseline(store);
            store.state.set(KEY('2026-03-31'), 'none');
            store.state.set(KEY('2026-06-30'), 'complete');
            store.state.set(KEY('2026-09-30'), 'panel');
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            await run13fIngest(deps);
            expect(calls.marked).toEqual([]);
            expect(calls.recomputes).toEqual([]);
        });

        it('only records the mode of a period seen for the first time (its positions are dirty already, flush uses the current mode)', async () => {
            const store = new FakeStore();
            withBaseline(store);
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            await run13fIngest(deps);
            expect(calls.marked).toEqual([]);
            expect(store.state.get(KEY('2026-06-30'))).toBe('complete');
            expect(store.state.get(KEY('2026-09-30'))).toBe('panel');
        });

        it('re-queues a period when it gains a baseline (none → panel/complete), e.g. the prior quarter finished backfilling', async () => {
            const store = new FakeStore();
            store.state.set(KEY('2026-09-30'), 'none');
            withBaseline(store);
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            await run13fIngest(deps);
            expect(calls.marked).toContain('2026-09-30');
        });

        it('updates the stored mode only AFTER the period was queued, so a crash in between re-queues it next run', async () => {
            const store = new FakeStore();
            withBaseline(store);
            store.state.set(KEY('2026-03-31'), 'none');
            store.state.set(KEY('2026-06-30'), 'panel');
            store.state.set(KEY('2026-09-30'), 'panel');
            const first = build({ latestFilingDate: '2026-10-14', store });
            first.deps.repo.markPeriodDirty = async () => {
                throw new Error('db down while queueing');
            };
            await expect(run13fIngest(first.deps)).rejects.toThrow(
                'db down while queueing'
            );
            expect(store.state.get(KEY('2026-06-30'))).toBe('panel'); // unchanged
            const second = build({ latestFilingDate: '2026-10-14', store });
            await run13fIngest(second.deps);
            expect(second.calls.marked).toEqual(['2026-06-30']);
            expect(store.state.get(KEY('2026-06-30'))).toBe('complete');
        });

        it('a period that crosses the filer threshold mid-run is re-queued after that date’s filings', async () => {
            const store = new FakeStore();
            store.state.set(KEY('2026-03-31'), 'none');
            store.state.set(KEY('2026-06-30'), 'none');
            store.state.set(KEY('2026-09-30'), 'none');
            let applied = 0;
            const { deps, calls } = build(original({ store }));
            const baseApply = deps.repo.applyFiling;
            deps.repo.applyFiling = async input => {
                applied += 1;
                // the prior quarter reaches the threshold while this date’s filing is applied
                store.filers = p => (p === '2026-06-30' ? 5000 : 0);
                return baseApply(input);
            };
            await run13fIngest(deps);
            expect(applied).toBe(1);
            expect(calls.marked).toContain('2026-09-30');
        });
    });

    describe('durable dirty tracking (crash safety)', () => {
        it('a crash between applyFiling and the flush loses nothing: the next run recomputes first, before reading SEC', async () => {
            const store = new FakeStore();
            // run 1: the filing is applied (dirty recorded), then the flush's recompute crashes
            const first = build(original({ store, recomputeThrowsAt: 1 }));
            await expect(run13fIngest(first.deps)).rejects.toThrow(
                'crash in recompute'
            );
            expect(first.calls.applied).toHaveLength(1);
            expect(first.calls.recomputes).toEqual([]);
            expect([...(store.dirty.get('2026-09-30') ?? [])].sort()).toEqual([
                1, 2, 3,
            ]); // still dirty
            expect(first.calls.cleared).toEqual([]); // never cleared without a committed recompute

            // run 2: the filing is already processed; the leftover dirty work is flushed
            const processed: FilingRecord = {
                accession: ORIGINAL_ACC,
                cik: '0002148692',
                period: '2026-09-30',
                filingDate: '2026-10-14',
                submissionType: '13F-HR',
                amendmentType: null,
                attempts: 0,
                processedAt: new Date(),
            };
            const second = build(
                original({ store, existing: { [ORIGINAL_ACC]: processed } })
            );
            await run13fIngest(second.deps);
            expect(second.calls.applied).toEqual([]);
            expect(second.calls.recomputes.map(r => r.period)).toEqual([
                '2026-09-30',
            ]);
            expect(second.calls.recomputes[0]?.cusips.sort()).toEqual([
                ABBOTT,
                MSFT,
                NVDA,
            ]);
            expect([...(store.dirty.get('2026-09-30') ?? [])]).toEqual([]);
            // recovery happens before any SEC request
            expect(second.calls.order[0]).toBe('recompute:2026-09-30:none');
        });

        it('clears dirty rows only after the recompute for them has finished', async () => {
            const { deps, calls } = build(original());
            await run13fIngest(deps);
            const recompute = calls.order.indexOf('recompute:2026-09-30:none');
            const clear = calls.order.indexOf('clear:2026-09-30');
            expect(recompute).toBeGreaterThanOrEqual(0);
            expect(clear).toBeGreaterThan(recompute);
        });

        it('keeps the dirty rows when applyFiling itself fails (the filing is retried, nothing half-recorded)', async () => {
            const { deps, store, calls } = build(
                original({ applyThrows: ORIGINAL_ACC })
            );
            const result = await run13fIngest(deps);
            expect(result.filingsFailed).toBe(1);
            expect(calls.failures).toHaveLength(1);
            expect([...store.dirty.values()].every(set => set.size === 0)).toBe(
                true
            );
        });
    });

    describe('exits (item: a filer that drops a CUSIP)', () => {
        /**
         * A stateful model of the contract: the first filing of a filer in a period marks that filer's
         * prior-quarter CUSIPs dirty. If the ingester forgot to say `firstForPeriod`, the dropped CUSIP
         * would never be recomputed and its `exited` count would stay stale.
         */
        function exitModel(firstForPeriodIsHonoured: boolean) {
            const prevHolders = new Map([[MSFT, new Set(['0002148692'])]]); // the filer held MSFT last quarter
            const exited = new Map<string, number>(); // MSFT → computed exited count
            const store = new FakeStore();
            const scenario = original({ store });
            const { deps, calls } = build(scenario, {});
            const baseApply = deps.repo.applyFiling;
            deps.repo.applyFiling = async input => {
                const touched = await baseApply(input);
                if (input.firstForPeriod && firstForPeriodIsHonoured) {
                    // the filing's rows do not include MSFT, but its prior holding must be recomputed
                    const set =
                        store.dirty.get(input.period as string) ??
                        new Set<number>();
                    for (const cusip of prevHolders.keys())
                        set.add(input.cusipIds.get(cusip) as number);
                    store.dirty.set(input.period as string, set);
                }
                return touched;
            };
            const baseRecompute = deps.repo.recomputeAggregates;
            deps.repo.recomputeAggregates = async (period, cusips, mode) => {
                await baseRecompute(period, cusips, mode);
                for (const cusip of cusips) {
                    if (cusip === MSFT)
                        exited.set(
                            cusip,
                            [...(prevHolders.get(MSFT) ?? [])].filter(
                                cik =>
                                    !calls.applied.some(
                                        a =>
                                            a.cik === cik &&
                                            a.rows.some(r => r.cusip === MSFT)
                                    )
                            ).length
                        );
                }
            };
            return { deps, exited, calls };
        }

        it('marks the first filing of the filer for the period so its prior holdings are recomputed', async () => {
            const { deps, calls } = build(original());
            await run13fIngest(deps);
            expect(calls.applied[0]?.firstForPeriod).toBe(true);
        });

        it('does not mark a later filing of the same filer and period as first', async () => {
            const { deps, calls } = build(
                original({
                    processed: [
                        {
                            accession: '0002085853-26-000001',
                            filingDate: '2026-10-01',
                            submissionType: '13F-HR',
                            amendmentType: null,
                        },
                    ],
                })
            );
            await run13fIngest(deps);
            expect(calls.applied[0]?.firstForPeriod).toBe(false);
        });

        it('a filer dropping a CUSIP changes the exited count, because its prior holdings are marked dirty', async () => {
            const model = exitModel(true);
            // the sample filing holds ABBOTT/MSFT/NVDA; make it drop MSFT
            const noMsft = INFO_TABLE_SAMPLE.replaceAll(MSFT, 'ZZZZZZZZ9');
            (
                model.deps.sec as { fetchFilingDocumentStream: unknown }
            ).fetchFilingDocumentStream = async () =>
                (async function* () {
                    yield new TextEncoder().encode(noMsft);
                })();
            await run13fIngest(model.deps);
            expect(
                model.calls.applied[0]?.rows.some(r => r.cusip === MSFT)
            ).toBe(false);
            expect(model.exited.get(MSFT)).toBe(1);
        });
    });

    describe('idempotency', () => {
        it('skips an accession that is already processed without touching SEC again', async () => {
            const done: FilingRecord = {
                accession: ORIGINAL_ACC,
                cik: '0002148692',
                period: '2026-09-30',
                filingDate: '2026-10-14',
                submissionType: '13F-HR',
                amendmentType: null,
                attempts: 0,
                processedAt: new Date(),
            };
            const { deps, calls } = build(
                original({ existing: { [done.accession]: done } })
            );
            const result = await run13fIngest(deps);
            expect(result).toMatchObject({
                filingsAlreadyDone: 1,
                filingsProcessed: 0,
            });
            expect(calls.indexJson).toEqual([]);
            expect(calls.applied).toEqual([]);
        });

        it('retries a previously failed accession that still has attempts left', async () => {
            const failed: FilingRecord = {
                accession: ORIGINAL_ACC,
                cik: '0002148692',
                period: null,
                filingDate: '2026-10-14',
                submissionType: '13F-HR',
                amendmentType: null,
                attempts: 2,
                processedAt: null,
            };
            const { deps, calls } = build(
                original({ existing: { [failed.accession]: failed } })
            );
            await run13fIngest(deps);
            expect(calls.applied).toHaveLength(1);
        });

        it('gives up on an accession that exhausted its attempts', async () => {
            const dead: FilingRecord = {
                accession: ORIGINAL_ACC,
                cik: '0002148692',
                period: null,
                filingDate: '2026-10-14',
                submissionType: '13F-HR',
                amendmentType: null,
                attempts: 3,
                processedAt: null,
            };
            const { deps, calls } = build(
                original({ existing: { [dead.accession]: dead } })
            );
            await run13fIngest(deps);
            expect(calls.applied).toEqual([]);
        });
    });

    describe('amendments', () => {
        const amendmentLine = indexLine(
            '13F-HR/A',
            'Howard Financial',
            '1768130',
            '20261014',
            '0001768130-26-000005'
        );
        const AMEND_ACC = '0001768130-26-000005';

        it('applies a RESTATEMENT as replace', async () => {
            const { deps, calls } = build(
                original({
                    days: { '2026-10-14': [amendmentLine] },
                    primaryDocs: {
                        [AMEND_ACC]: PRIMARY_DOC_RESTATEMENT.replace(
                            '03-31-2017',
                            '06-30-2026'
                        ),
                    },
                })
            );
            await run13fIngest(deps);
            expect(calls.applied[0]).toMatchObject({
                submissionType: '13F-HR/A',
                amendmentType: 'RESTATEMENT',
                mode: 'replace',
            });
        });

        describe('re-ingest (ledger rows deleted by reingest-13f, positions still stored)', () => {
            it('applies a re-read ORIGINAL as merge so already-merged NEW HOLDINGS rows are not wiped', async () => {
                const { deps, calls } = build(
                    original({ positionsExist: true })
                );
                await run13fIngest(deps);
                expect(calls.applied[0]).toMatchObject({
                    submissionType: '13F-HR',
                    mode: 'merge',
                });
            });

            it('a first-time original (no stored positions) is still a replace', async () => {
                const { deps, calls } = build(original());
                await run13fIngest(deps);
                expect(calls.applied[0]?.mode).toBe('replace');
            });

            it('a re-read RESTATEMENT is still a replace (replacement is its definition)', async () => {
                const { deps, calls } = build(
                    original({
                        positionsExist: true,
                        days: { '2026-10-14': [amendmentLine] },
                        primaryDocs: {
                            [AMEND_ACC]: PRIMARY_DOC_RESTATEMENT.replace(
                                '03-31-2017',
                                '06-30-2026'
                            ),
                        },
                    })
                );
                await run13fIngest(deps);
                expect(calls.applied[0]?.mode).toBe('replace');
            });
        });

        it('applies NEW HOLDINGS as merge when an original was already applied', async () => {
            const { deps, calls } = build(
                original({
                    days: { '2026-10-14': [amendmentLine] },
                    primaryDocs: { [AMEND_ACC]: PRIMARY_DOC_NEW_HOLDINGS },
                    processed: [
                        {
                            accession: '0001768130-26-000001',
                            filingDate: '2026-08-01',
                            submissionType: '13F-HR',
                            amendmentType: null,
                        },
                    ],
                })
            );
            await run13fIngest(deps);
            expect(calls.applied[0]).toMatchObject({
                amendmentType: 'NEW HOLDINGS',
                mode: 'merge',
            });
        });

        it('skips an amendment superseded by a later RESTATEMENT (no dirty, no recompute)', async () => {
            const { deps, calls } = build(
                original({
                    days: { '2026-10-14': [amendmentLine] },
                    primaryDocs: { [AMEND_ACC]: PRIMARY_DOC_NEW_HOLDINGS },
                    processed: [
                        {
                            accession: '0001768130-26-000099',
                            filingDate: '2026-10-14',
                            submissionType: '13F-HR/A',
                            amendmentType: 'RESTATEMENT',
                        },
                    ],
                })
            );
            await run13fIngest(deps);
            expect(calls.applied[0]?.mode).toBe('skip');
            expect(calls.recomputes).toEqual([]);
        });

        describe('an earlier RESTATEMENT applied after a later NEW HOLDINGS (order inverted by a backfill/retry)', () => {
            const later: AmendmentFiling = {
                accession: '0001768130-26-000020',
                filingDate: '2026-10-14',
                submissionType: '13F-HR/A',
                amendmentType: 'NEW HOLDINGS',
            };
            const restatementScenario = (extra: Partial<Scenario> = {}) =>
                original({
                    days: {
                        '2026-10-13': [
                            indexLine(
                                '13F-HR/A',
                                'Howard Financial',
                                '1768130',
                                '20261013',
                                AMEND_ACC
                            ),
                        ],
                    },
                    primaryDocs: {
                        [AMEND_ACC]: PRIMARY_DOC_RESTATEMENT.replace(
                            '03-31-2017',
                            '09-30-2026'
                        ),
                    },
                    processed: [later],
                    ...extra,
                });

            it('applies the restatement and the later NEW HOLDINGS in ONE applyFiling call (one transaction)', async () => {
                const { deps, calls } = build(restatementScenario());
                await run13fIngest(deps);
                expect(
                    calls.applied.map(a => `${a.accession}:${a.mode}`)
                ).toEqual([`${AMEND_ACC}:replace`]);
                expect(
                    calls.applied[0]?.reapply?.map(r => r.accession)
                ).toEqual([later.accession]);
                expect(
                    calls.applied[0]?.reapply?.[0]?.rows.length
                ).toBeGreaterThan(0);
            });

            it('downloads the later amendment’s own information table BEFORE applying anything', async () => {
                const { deps, calls } = build(restatementScenario());
                await run13fIngest(deps);
                expect(calls.infoTable).toEqual([AMEND_ACC, later.accession]);
                expect(
                    calls.order.indexOf(`apply:${AMEND_ACC}:replace`)
                ).toBeGreaterThanOrEqual(0);
            });

            describe('when the re-apply download fails the replace must NOT be applied (otherwise the later positions are lost for good)', () => {
                const failingLater = (error: Error) => {
                    const made = build(restatementScenario());
                    const base = made.deps.sec.fetchFilingDocumentStream;
                    made.deps.sec.fetchFilingDocumentStream = async (
                        cik,
                        accession,
                        name
                    ) => {
                        if (accession === later.accession) throw error;
                        return base(cik, accession, name);
                    };
                    return made;
                };

                it('records a failure and applies nothing (the restatement is retried as a whole)', async () => {
                    const { deps, calls } = failingLater(
                        new Error('SEC stalled')
                    );
                    const result = await run13fIngest(deps);
                    expect(calls.applied).toEqual([]);
                    expect(result.filingsFailed).toBe(1);
                    expect(calls.failures).toEqual([
                        { accession: AMEND_ACC, error: 'SEC stalled' },
                    ]);
                });

                it('on a SEC block: stops the run, applies nothing and records no failure', async () => {
                    const { deps, calls } = failingLater(new Error('blocked'));
                    const result = await run13fIngest(deps);
                    expect(result.stoppedBy).toBe('sec_blocked');
                    expect(calls.applied).toEqual([]);
                    expect(calls.failures).toEqual([]);
                });

                it('when the index.json lookup of the later amendment fails', async () => {
                    const made = build(restatementScenario());
                    const base = made.deps.sec.fetchFilingIndexJson;
                    made.deps.sec.fetchFilingIndexJson = async (
                        cik,
                        accession
                    ) => {
                        if (accession === later.accession)
                            throw new Error('index down');
                        return base(cik, accession);
                    };
                    await run13fIngest(made.deps);
                    expect(made.calls.applied).toEqual([]);
                    expect(made.calls.failures).toHaveLength(1);
                });

                it('a missing information table for the later amendment also blocks the replace', async () => {
                    const made = build(restatementScenario());
                    const base = made.deps.sec.fetchFilingDocumentStream;
                    made.deps.sec.fetchFilingDocumentStream = async (
                        cik,
                        accession,
                        name
                    ) =>
                        accession === later.accession
                            ? null
                            : base(cik, accession, name);
                    await run13fIngest(made.deps);
                    expect(made.calls.applied).toEqual([]);
                    expect(made.calls.failures[0]?.error).toBe(
                        'information table missing'
                    );
                });
            });

            it('does not start a re-apply download once the deadline has passed: defers the whole filing without a failure record', async () => {
                const { deps, calls } = build(restatementScenario());
                // deadline trips after the restatement's own table was downloaded (the 1st stream fetch)
                deps.isDeadlineReached = () => calls.infoTable.length >= 1;
                const result = await run13fIngest(deps);
                expect(result.stoppedBy).toBe('deadline');
                expect(calls.infoTable).toEqual([AMEND_ACC]);
                expect(calls.applied).toEqual([]);
                expect(calls.failures).toEqual([]);
            });

            it('refuses to re-apply an absurd number of later amendments (fails the filing so it is retried, never half-applied)', async () => {
                const many: AmendmentFiling[] = Array.from(
                    { length: INVESTOR_FLOWS_MAX_REAPPLY + 1 },
                    (_, i) => ({
                        ...later,
                        accession: `0001768130-26-0001${String(i).padStart(2, '0')}`,
                    })
                );
                const { deps, calls } = build(
                    restatementScenario({ processed: many })
                );
                await run13fIngest(deps);
                expect(calls.applied).toEqual([]);
                expect(calls.failures[0]?.error).toContain(
                    'too many later amendments'
                );
            });

            it('does not re-apply NEW HOLDINGS that were filed BEFORE the restatement (they are superseded by it)', async () => {
                const { deps, calls } = build(
                    restatementScenario({
                        processed: [{ ...later, filingDate: '2026-10-01' }],
                    })
                );
                await run13fIngest(deps);
                expect(calls.applied.map(a => a.mode)).toEqual(['replace']);
            });
        });
    });

    describe('periods that are not collected', () => {
        const cases: [string, string][] = [
            ['before the retention floor', '09-30-2025'],
            ['before dollar-denominated values (2023-03-31)', '12-31-2022'],
            ['not a quarter end', '09-29-2026'],
        ];
        it.each(cases)(
            'records the filing as processed without positions or an information table fetch: %s',
            async (_label, period) => {
                const { deps, calls } = build(
                    original({
                        primaryDocs: {
                            [ORIGINAL_ACC]: PRIMARY_DOC_ORIGINAL.replaceAll(
                                '09-30-2026',
                                period
                            ),
                        },
                    })
                );
                await run13fIngest(deps);
                expect(calls.applied[0]).toMatchObject({
                    mode: 'skip',
                    rows: [],
                });
                expect(calls.infoTable).toEqual([]);
            }
        );

        it('skips a NOTICE report type', async () => {
            const { deps, calls } = build(
                original({
                    primaryDocs: {
                        [ORIGINAL_ACC]: PRIMARY_DOC_ORIGINAL.replace(
                            '13F HOLDINGS REPORT',
                            '13F NOTICE'
                        ),
                    },
                })
            );
            await run13fIngest(deps);
            expect(calls.applied[0]?.mode).toBe('skip');
            expect(calls.infoTable).toEqual([]);
        });
    });

    describe('failures', () => {
        it('records a filing whose index lacks primary_doc.xml and continues with the next', async () => {
            const second = indexLine(
                '13F-HR',
                'Other LLC',
                '2102803',
                '20261014',
                '0002102803-26-000004'
            );
            const { deps, calls } = build(
                original({ days: { '2026-10-14': [ORIGINAL_LINE, second] } })
            );
            const originalFetch = deps.sec.fetchFilingIndexJson;
            deps.sec.fetchFilingIndexJson = async (cik, accession) =>
                accession === ORIGINAL_ACC
                    ? { directory: { item: [] } }
                    : originalFetch(cik, accession);
            const result = await run13fIngest(deps);
            expect(result).toMatchObject({
                filingsFailed: 1,
                filingsProcessed: 1,
            });
            expect(calls.failures).toEqual([
                {
                    accession: ORIGINAL_ACC,
                    error: 'primary_doc.xml not found in filing index',
                },
            ]);
        });

        it('records malformed information-table XML as a failure instead of crashing the run', async () => {
            const { deps, calls } = build(
                original({
                    infoTables: {
                        [ORIGINAL_ACC]:
                            '<informationTable><infoTable><cusip>1</infoTable>',
                    },
                })
            );
            const result = await run13fIngest(deps);
            expect(result.filingsFailed).toBe(1);
            expect(calls.failures).toHaveLength(1);
            expect(calls.applied).toEqual([]);
        });

        it('retries pending failures that fall outside the date window', async () => {
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                pending: [
                    {
                        accession: ORIGINAL_ACC,
                        cik: '0002148692',
                        filingDate: '2026-07-20',
                        submissionType: '13F-HR',
                    },
                ],
            });
            const result = await run13fIngest(deps);
            expect(result.retried).toBe(1);
            expect(calls.applied).toHaveLength(1);
        });

        it('warns (metric-filter prefix) when permanently failed accessions pile up', async () => {
            const { deps, store } = build({ latestFilingDate: '2026-10-14' });
            store.exhausted = INVESTOR_FLOWS_FAILED_BACKLOG_ALERT;
            await run13fIngest(deps);
            expect(deps.log).toHaveBeenCalledWith(
                expect.stringContaining('[sec-13f] backlog')
            );
        });

        it('does not warn below the backlog threshold', async () => {
            const { deps, store } = build({ latestFilingDate: '2026-10-14' });
            store.exhausted = INVESTOR_FLOWS_FAILED_BACKLOG_ALERT - 1;
            await run13fIngest(deps);
            expect(deps.log).not.toHaveBeenCalledWith(
                expect.stringContaining('[sec-13f] backlog')
            );
        });
    });

    describe('stop decisions (SEC block / deadline) leave no sibling work running', () => {
        const twoFilers = [
            indexLine(
                '13F-HR',
                'A LLC',
                '2148692',
                '20261014',
                '0002085853-26-001185'
            ),
            indexLine(
                '13F-HR',
                'B LLC',
                '2102803',
                '20261014',
                '0002102803-26-000004'
            ),
        ];

        it('a SEC block stops immediately, does not prune, logs the metric-filter line and makes no failure record', async () => {
            const { deps, calls } = build(original());
            deps.sec.fetchFilingIndexJson = async () => {
                throw new Error('blocked');
            };
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('sec_blocked');
            expect(calls.failures).toEqual([]);
            expect(calls.prunes).toEqual([]);
            expect(deps.log).toHaveBeenCalledWith(
                expect.stringContaining('[sec-13f] sec_blocked')
            );
        });

        it('when one filer is blocked the other filer of the same wave does not start another filing', async () => {
            const third = indexLine(
                '13F-HR/A',
                'A LLC',
                '2148692',
                '20261014',
                '0002085853-26-009999'
            );
            const { deps, calls } = build(
                original({ days: { '2026-10-14': [...twoFilers, third] } })
            );
            const originalIndex = deps.sec.fetchFilingIndexJson;
            deps.sec.fetchFilingIndexJson = async (cik, accession) => {
                if (accession === '0002102803-26-000004')
                    throw new Error('blocked');
                return originalIndex(cik, accession);
            };
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('sec_blocked');
            // A's second filing (group order: ..001185 then ..009999) must not begin after the stop was decided
            expect(calls.indexJson).not.toContain('0002085853-26-009999');
        });

        it('a DB failure in one group is rethrown only after its siblings have settled', async () => {
            const { deps, calls } = build(
                original({ days: { '2026-10-14': twoFilers } })
            );
            const order: string[] = [];
            const originalFail = deps.repo.recordFailure;
            deps.sec.fetchFilingIndexJson = async (_cik, accession) => {
                if (accession === '0002085853-26-001185')
                    throw new Error('boom'); // → recordFailure
                await new Promise(resolve => setTimeout(resolve, 20));
                order.push('sibling-finished');
                return FILING_INDEX_JSON;
            };
            deps.repo.recordFailure = async (filing, error) => {
                await originalFail(filing, error);
                order.push('rethrow');
                throw new Error('db down');
            };
            await expect(run13fIngest(deps)).rejects.toThrow('db down');
            expect(order).toEqual(['rethrow', 'sibling-finished']);
            expect(calls.failures).toHaveLength(1);
        });

        it('the deadline is checked inside a filer group too: the second filing of a group is not started', async () => {
            const second = indexLine(
                '13F-HR/A',
                'A LLC',
                '2148692',
                '20261014',
                '0002085853-26-009999'
            );
            const { deps, calls } = build(
                original({ days: { '2026-10-14': [ORIGINAL_LINE, second] } })
            );
            let applied = 0;
            const baseApply = deps.repo.applyFiling;
            deps.repo.applyFiling = async input => {
                applied += 1;
                return baseApply(input);
            };
            // the deadline trips once the first filing of the group has been applied
            deps.isDeadlineReached = () => applied >= 1;
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('deadline');
            expect(calls.applied).toHaveLength(1);
        });

        it('stops when the daily index itself is refused', async () => {
            const { deps, calls } = build({ latestFilingDate: '2026-10-12' });
            deps.sec.fetchDailyFormIndex = async date => {
                calls.indexDates.push(date);
                throw new Error('blocked');
            };
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('sec_blocked');
            expect(calls.indexDates).toEqual(['2026-10-09']);
        });
    });

    describe('deadline', () => {
        it('stops with deadline before starting new work, still pruning', async () => {
            const { deps, calls } = build(original());
            deps.isDeadlineReached = () => true;
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('deadline');
            expect(calls.indexDates).toEqual([]);
            expect(calls.prunes.length).toBeGreaterThan(0);
        });

        it('flushes aggregates for filings applied before the deadline hit', async () => {
            const second = indexLine(
                '13F-HR',
                'Other LLC',
                '2102803',
                '20261014',
                '0002102803-26-000004'
            );
            let checks = 0;
            const { deps, calls } = build(
                original({ days: { '2026-10-14': [ORIGINAL_LINE, second] } })
            );
            // start-of-run flush (1), dates 10-12/13/14 (2-4), wave (5), filer A (6), filer B (7), then 10-15 trips it
            deps.isDeadlineReached = () => ++checks > 7;
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('deadline');
            expect(calls.applied).toHaveLength(2);
            expect(calls.recomputes.map(r => r.period)).toEqual(['2026-09-30']);
        });
    });

    describe('cursor', () => {
        it('starts 200 days back when the ledger is empty (backfill) and skips weekends', async () => {
            const { deps, calls } = build();
            const result = await run13fIngest(deps);
            expect(result.startDate).toBe('2026-03-29');
            expect(calls.indexDates[0]).toBe('2026-03-30'); // 03-29 is a Sunday
            expect(calls.indexDates.at(-1)).toBe('2026-10-15');
            expect(calls.indexDates).not.toContain('2026-04-04'); // Saturday
        });

        it('resumes a few days before the latest ledger date', async () => {
            const { deps, calls } = build({ latestFilingDate: '2026-10-12' });
            const result = await run13fIngest(deps);
            expect(CURSOR_OVERLAP_DAYS).toBe(3);
            expect(result.startDate).toBe('2026-10-09');
            expect(calls.indexDates).toEqual([
                '2026-10-09',
                '2026-10-12',
                '2026-10-13',
                '2026-10-14',
                '2026-10-15',
            ]);
        });

        it('never starts before the backfill window even if the ledger is ancient', async () => {
            const { deps } = build({ latestFilingDate: '2025-01-01' });
            expect((await run13fIngest(deps)).startDate).toBe('2026-03-29');
        });
    });

    describe('universe gate (cusip-map full pass)', () => {
        const withDay = (store: FakeStore) =>
            build(
                {
                    store,
                    days: { '2026-10-14': [ORIGINAL_LINE] },
                    primaryDocs: { [ORIGINAL_ACC]: PRIMARY_DOC_ORIGINAL },
                    infoTables: { [ORIGINAL_ACC]: INFO_TABLE_SAMPLE },
                },
                {}
            );

        it('returns universe_incomplete and touches neither SEC nor the DB until cusip-map finished a full pass', async () => {
            const store = new FakeStore();
            store.state.delete(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE);
            const { deps, calls } = withDay(store);
            const loadUniverse = vi.spyOn(deps, 'loadUniverse');

            const result = await run13fIngest(deps);

            expect(result.stoppedBy).toBe('universe_incomplete');
            expect(result.filingsProcessed).toBe(0);
            expect(calls.indexDates).toEqual([]);
            expect(calls.applied).toEqual([]);
            expect(loadUniverse).not.toHaveBeenCalled();
            expect(deps.log).toHaveBeenCalledWith(
                expect.stringContaining('[sec-13f] universe_incomplete')
            );
        });

        it('ingests normally once the marker exists, and the marker is never written by sec-13f', async () => {
            const store = new FakeStore();
            store.state.delete(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE);
            const blocked = withDay(store);
            expect((await run13fIngest(blocked.deps)).stoppedBy).toBe(
                'universe_incomplete'
            );
            expect(
                store.state.has(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)
            ).toBe(false);

            store.state.set(
                INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
                '2026-10-10T00:00:00.000Z'
            );
            const open = withDay(store);
            const result = await run13fIngest(open.deps);
            expect(result.stoppedBy).toBe('complete');
            expect(result.filingsProcessed).toBe(1);
        });

        it('stamps every applied filing with the universe snapshot it was parsed against', async () => {
            const { deps, calls } = withDay(new FakeStore());
            await run13fIngest(deps);
            expect(calls.applied).toHaveLength(1);
            expect(calls.applied[0]?.universeStamp).toBe(UNIVERSE.loadedAt);
        });
    });

    describe('universe', () => {
        it('does nothing when the CUSIP map is empty', async () => {
            const { deps, calls } = build();
            deps.loadUniverse = async () => ({
                cusips: new Map(),
                symbols: [],
                loadedAt: '2026-10-15 11:00:00+00',
            });
            const result = await run13fIngest(deps);
            expect(result.stoppedBy).toBe('empty_universe');
            expect(calls.indexDates).toEqual([]);
        });
    });

    describe('same filer ordering', () => {
        it('processes one filer’s filings sequentially in filing order', async () => {
            const a = indexLine(
                '13F-HR',
                'Same LLC',
                '2148692',
                '20261014',
                '0002085853-26-001185'
            );
            const b = indexLine(
                '13F-HR/A',
                'Same LLC',
                '2148692',
                '20261014',
                '0002085853-26-001200'
            );
            const { deps, calls } = build(
                original({
                    days: { '2026-10-14': [b, a] },
                    primaryDocs: {
                        '0002085853-26-001200':
                            PRIMARY_DOC_NEW_HOLDINGS.replace(
                                '06-30-2026',
                                '09-30-2026'
                            ),
                    },
                })
            );
            await run13fIngest(deps);
            expect(calls.applied.map(x => x.accession)).toEqual([
                '0002085853-26-001185',
                '0002085853-26-001200',
            ]);
        });
    });

    describe('retention pruning (state-gated, batched)', () => {
        it('prunes positions below the floor and records the floor once it is done', async () => {
            const { deps, calls, store } = build({
                latestFilingDate: '2026-10-14',
            });
            await run13fIngest(deps);
            expect(calls.prunes).toEqual([
                'positions<2026-03-31',
                'aggregates<2023-09-30',
                'filings<2024-08-06',
            ]);
            expect(store.state.get('sec13f_positions_pruned_floor')).toBe(
                '2026-03-31'
            );
        });

        it('skips the position prune entirely when the floor did not move, and runs the date prunes once a day', async () => {
            const store = new FakeStore();
            const first = build({ latestFilingDate: '2026-10-14', store });
            await run13fIngest(first.deps);
            const second = build({ latestFilingDate: '2026-10-14', store });
            await run13fIngest(second.deps);
            expect(second.calls.prunes).toEqual([]);
        });

        it('prunes positions again when the floor moves to a later quarter', async () => {
            const store = new FakeStore();
            store.state.set('sec13f_positions_pruned_floor', '2025-12-31');
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            await run13fIngest(deps);
            expect(calls.prunes[0]).toBe('positions<2026-03-31');
        });

        it('does not record the floor when the prune ran out of its time box (the next run continues)', async () => {
            const store = new FakeStore();
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            const nowSpy = vi.spyOn(Date, 'now');
            let t = 0;
            nowSpy.mockImplementation(() => (t += 200_000)); // every look at the clock burns 200s
            try {
                await run13fIngest(deps);
            } finally {
                nowSpy.mockRestore();
            }
            expect(calls.prunes).toContain('positions<2026-03-31');
            expect(store.state.has('sec13f_positions_pruned_floor')).toBe(
                false
            );
        });
    });

    describe('cache invalidation cap', () => {
        it('invalidates at most INVESTOR_FLOWS_REVALIDATE_CAP symbols per run', async () => {
            const many: InvestorFlowsUniverse = {
                cusips: new Map(
                    Array.from(
                        { length: INVESTOR_FLOWS_REVALIDATE_CAP + 50 },
                        (_, i) => [
                            String(i).padStart(9, '0'),
                            { id: i + 10, symbol: `S${i}` },
                        ]
                    )
                ),
                symbols: [],
                loadedAt: '2026-10-15 11:00:00+00',
            };
            const store = new FakeStore();
            store.dirty.set(
                '2026-09-30',
                new Set(
                    Array.from(
                        { length: INVESTOR_FLOWS_REVALIDATE_CAP + 50 },
                        (_, i) => i + 10
                    )
                )
            );
            const { deps, calls } = build({
                latestFilingDate: '2026-10-14',
                store,
            });
            deps.loadUniverse = async () => many;
            // the fake takeDirty resolves ids through the shared UNIVERSE; give it the larger universe
            deps.repo.takeDirty = async () => {
                const ids = [...(store.dirty.get('2026-09-30') ?? [])];
                if (ids.length === 0) return null;
                const byId = new Map(
                    [...many.cusips].map(([cusip, v]) => [
                        v.id,
                        { cusip, symbol: v.symbol },
                    ])
                );
                return {
                    period: '2026-09-30',
                    entries: ids.map(id => ({
                        id,
                        ...(byId.get(id) as { cusip: string; symbol: string }),
                    })),
                };
            };
            await run13fIngest(deps);
            expect(calls.invalidated[0]).toHaveLength(
                INVESTOR_FLOWS_REVALIDATE_CAP
            );
        });
    });
});
