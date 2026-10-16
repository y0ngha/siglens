import { describe, expect, it, vi } from 'vitest';
import type { FmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import { MISS_TTL_SECONDS } from '../../api/cusipMissStore';
import type {
    CusipMapRow,
    RecheckCandidate,
} from '../../api/investorFlowsUniverseRepository';
import {
    INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD,
    INVESTOR_FLOWS_CUSIP_RECHECK_BATCH,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
    INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED,
} from '../../lib/investorFlowsPolicy';
import {
    MAX_SYMBOLS_PER_RUN,
    runCusipMapSync,
    type SyncCusipMapDeps,
} from '../../server/syncCusipMap';

const profile = (
    over: Partial<FmpProfileIdentifiers> = {}
): FmpProfileIdentifiers => ({
    cusip: null,
    isin: null,
    isEtf: false,
    isFund: false,
    ...over,
});

/** What survives between daily runs: the DB (marker, mappings) and Redis (consecutive-failure counters, misses). */
function newShared() {
    return {
        state: new Map<string, string>(),
        written: [] as CusipMapRow[],
        failCounts: new Map<string, number>(),
        failMarked: new Set<string>(),
        countedDays: new Set<string>(),
        /** days since 2026-10-16 — each test bumps it to simulate the next daily run. */
        day: 0,
    };
}

function build(
    profiles: Record<string, FmpProfileIdentifiers | null | Error>,
    over: Partial<SyncCusipMapDeps> = {},
    figi: Record<string, string[]> = {},
    recent: string[] = [],
    shared = newShared()
) {
    const { state, written, failCounts, failMarked, countedDays } = shared;
    const mapped = { count: INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED };
    const recheck = {
        candidates: [] as RecheckCandidate[],
        existing: [] as string[],
        checked: [] as number[],
    };
    const missRecords: { symbol: string; ttlSeconds: number }[] = [];
    const symbols = Object.keys(profiles);
    const fetched: string[] = [];
    const deps: SyncCusipMapDeps = {
        repo: {
            listUnmappedUsSymbols: async (after, limit) =>
                symbols
                    .filter(
                        s => s > after && !written.some(w => w.symbol === s)
                    )
                    .slice(0, limit),
            upsertCusipMap: async rows => {
                written.push(...rows);
            },
            listRecheckCandidates: async () => recheck.candidates,
            markChecked: async ids => {
                recheck.checked.push(...ids);
            },
            findExistingCusips: async cusips =>
                new Set(cusips.filter(c => recheck.existing.includes(c))),
            countMapped: async () => mapped.count,
            getState: async key => state.get(key) ?? null,
            setStateIfAbsent: async (key, value) => {
                if (!state.has(key)) state.set(key, value);
            },
        },
        misses: {
            findRecentMisses: async list =>
                new Set(
                    list.filter(s => recent.includes(s) || failMarked.has(s))
                ),
            recordMisses: async entries => {
                missRecords.push(...entries);
            },
            recordFailures: async (list, threshold, _ttl, day) => {
                const marked: string[] = [];
                for (const symbol of list) {
                    // at most one count per symbol per day (the real store does this with SET NX)
                    if (countedDays.has(`${symbol}:${day}`)) continue;
                    countedDays.add(`${symbol}:${day}`);
                    const count = (failCounts.get(symbol) ?? 0) + 1;
                    if (count >= threshold) {
                        failCounts.delete(symbol);
                        failMarked.add(symbol);
                        marked.push(symbol);
                    } else failCounts.set(symbol, count);
                }
                return marked;
            },
        },
        fetchProfile: async symbol => {
            fetched.push(symbol);
            const value = profiles[symbol];
            if (value instanceof Error) throw value;
            return value ?? null;
        },
        mapCusipsToTickers: async cusips =>
            new Map(cusips.map(c => [c, figi[c] ?? []])),
        isRateLimitError: error =>
            error instanceof Error && error.message === '429',
        isDeadlineReached: () => false,
        now: () => new Date(Date.UTC(2026, 9, 16 + shared.day, 3)),
        log: vi.fn(),
        ...over,
    };
    return {
        deps,
        written,
        missRecords,
        fetched,
        recheck,
        state,
        mapped,
        shared,
    };
}

describe('runCusipMapSync', () => {
    describe('full-pass marker (unlocks sec-13f)', () => {
        const KEY = INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE;

        it('is set when the pass completes with zero candidates and the map is big enough', async () => {
            const { deps, state } = build({});
            const result = await runCusipMapSync(deps);
            expect(result).toMatchObject({
                status: 'complete',
                candidates: 0,
                universeCompleted: true,
            });
            expect(state.get(KEY)).toBe('2026-10-16T03:00:00.000Z');
        });

        it('is NOT set while candidates remain (even if this run mapped some)', async () => {
            const { deps, state } = build({
                AAPL: profile({ cusip: '037833100' }),
            });
            const result = await runCusipMapSync(deps);
            expect(result.candidates).toBe(1);
            expect(result.universeCompleted).toBe(false);
            expect(state.has(KEY)).toBe(false);
        });

        it('is NOT set when the run was capped at MAX_SYMBOLS_PER_RUN', async () => {
            const profiles: Record<string, FmpProfileIdentifiers | null> = {};
            for (let i = 0; i < MAX_SYMBOLS_PER_RUN + 5; i += 1)
                profiles[`S${String(i).padStart(5, '0')}`] = null;
            const { deps, state } = build(profiles);
            const result = await runCusipMapSync(deps);
            expect(result.status).toBe('capped');
            expect(state.has(KEY)).toBe(false);
        });

        it('is NOT set after a deadline or rate-limited stop', async () => {
            const deadline = build(
                { AAPL: profile({ cusip: '037833100' }) },
                { isDeadlineReached: () => true }
            );
            expect((await runCusipMapSync(deadline.deps)).status).toBe(
                'deadline'
            );
            expect(deadline.state.has(KEY)).toBe(false);

            const limited = build({ AAPL: new Error('429') });
            const result = await runCusipMapSync(limited.deps);
            expect(result.status).toBe('rate_limited');
            expect(limited.state.has(KEY)).toBe(false);
        });

        it('is NOT set when the map is smaller than the plausible minimum (empty ticker DB)', async () => {
            const { deps, state, mapped } = build({});
            mapped.count = INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED - 1;
            const result = await runCusipMapSync(deps);
            expect(result.universeCompleted).toBe(false);
            expect(state.has(KEY)).toBe(false);
            expect(deps.log).toHaveBeenCalledWith(
                expect.stringContaining('universe not marked complete')
            );
        });

        describe('a backlog that cannot map still drains (otherwise sec-13f is stuck on universe_incomplete forever)', () => {
            const BAD = 'BAD';
            const FAIL = INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD;

            it('a symbol whose FMP profile rejects with a non-429 error on every run is skipped after the threshold, and the marker is then set', async () => {
                const shared = newShared();
                const profiles = {
                    AAPL: profile({ cusip: '037833100' }),
                    [BAD]: new Error('402 payment required'),
                };
                const results = [];
                for (let day = 0; day < FAIL + 1; day += 1) {
                    shared.day = day;
                    const { deps } = build(profiles, {}, {}, [], shared);
                    results.push(await runCusipMapSync(deps));
                }
                // days 1..FAIL: BAD is still a candidate, so the marker stays unset
                for (let day = 0; day < FAIL; day += 1) {
                    expect(results[day]?.candidates).toBeGreaterThan(0);
                }
                expect(results[FAIL - 1]?.failuresMarked).toBe(1);
                // the day after the threshold: no candidates left -> marker set
                expect(results[FAIL]).toMatchObject({
                    candidates: 0,
                    universeCompleted: true,
                });
                expect(shared.state.has(KEY)).toBe(true);
            });

            it('three runs on the SAME day count as one failure: the symbol is not marked and the marker stays unset', async () => {
                const shared = newShared();
                const profiles = { [BAD]: new Error('503') };
                for (let run = 0; run < FAIL + 2; run += 1) {
                    const { deps } = build(profiles, {}, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r.failuresMarked).toBe(0);
                    expect(r.universeCompleted).toBe(false);
                }
                expect(shared.failMarked.size).toBe(0);
                expect(shared.failCounts.get(BAD)).toBe(1);
            });

            it('a blanket outage run (every profile fetch fails) counts nothing and says so', async () => {
                const shared = newShared();
                const many = Object.fromEntries(
                    Array.from({ length: 30 }, (_, i) => [
                        `S${String(i).padStart(3, '0')}`,
                        new Error('503') as Error,
                    ])
                );
                for (let day = 0; day < FAIL + 1; day += 1) {
                    shared.day = day;
                    const { deps } = build(many, {}, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r).toMatchObject({
                        blanketOutage: true,
                        failuresMarked: 0,
                        universeCompleted: false,
                    });
                    expect(deps.log).toHaveBeenCalledWith(
                        expect.stringContaining('blanket FMP outage')
                    );
                }
                expect(shared.failCounts.size).toBe(0);
                expect(shared.failMarked.size).toBe(0);
            });

            it('one persistent failure among many healthy symbols is NOT a blanket outage and still drains over 3 days', async () => {
                const shared = newShared();
                const healthy = Object.fromEntries(
                    Array.from({ length: 30 }, (_, i) => [
                        `S${String(i).padStart(3, '0')}`,
                        profile({
                            cusip: `0000000${String(i).padStart(2, '0')}`,
                        }),
                    ])
                );
                const profiles = { ...healthy, [BAD]: new Error('400') };
                let last;
                for (let day = 0; day < FAIL + 1; day += 1) {
                    shared.day = day;
                    const { deps } = build(profiles, {}, {}, [], shared);
                    last = await runCusipMapSync(deps);
                    expect(last.blanketOutage).toBe(false);
                }
                expect(shared.failMarked.has(BAD)).toBe(true);
                expect(last).toMatchObject({
                    candidates: 0,
                    universeCompleted: true,
                });
            });

            describe('blanket-outage boundary: 20 attempts, ratio 0.9', () => {
                /** 20 symbols, the first `failing` of them reject, the rest map fine. */
                const twenty = (failing: number) =>
                    Object.fromEntries(
                        Array.from({ length: 20 }, (_, i) => [
                            `B${String(i).padStart(2, '0')}`,
                            i < failing
                                ? (new Error('503') as Error)
                                : profile({
                                      cusip: `1111111${String(i).padStart(2, '0')}`,
                                  }),
                        ])
                    );

                it('18 of 20 failed (= 0.9) is a blanket outage: nothing is counted', async () => {
                    const shared = newShared();
                    const { deps } = build(twenty(18), {}, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r.blanketOutage).toBe(true);
                    expect(shared.failCounts.size).toBe(0);
                    expect(deps.log).toHaveBeenCalledWith(
                        expect.stringContaining('18 of 20 profile fetches')
                    );
                });

                it('17 of 20 failed (0.85) is NOT a blanket outage: the 17 are counted', async () => {
                    const shared = newShared();
                    const { deps } = build(twenty(17), {}, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r.blanketOutage).toBe(false);
                    expect(shared.failCounts.size).toBe(17);
                });

                it('19 attempts all failing is below the minimum attempts: counted, not blanket', async () => {
                    const shared = newShared();
                    const nineteen = Object.fromEntries(
                        Array.from({ length: 19 }, (_, i) => [
                            `C${String(i).padStart(2, '0')}`,
                            new Error('503') as Error,
                        ])
                    );
                    const { deps } = build(nineteen, {}, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r.blanketOutage).toBe(false);
                    expect(shared.failCounts.size).toBe(19);
                });
            });

            it('a blanket OpenFIGI outage (many FIGI candidates, the call throws) counts nothing', async () => {
                const shared = newShared();
                const many = Object.fromEntries(
                    Array.from({ length: 25 }, (_, i) => [
                        `F${String(i).padStart(3, '0')}`,
                        profile({ isin: 'US0378331005' }),
                    ])
                );
                const down = {
                    mapCusipsToTickers: async () => {
                        throw new Error('openfigi 500');
                    },
                };
                for (let day = 0; day < FAIL + 1; day += 1) {
                    shared.day = day;
                    const { deps } = build(many, down, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r.blanketOutage).toBe(true);
                }
                expect(shared.failMarked.size).toBe(0);
            });

            it('a transient failure is retried first: one failure marks nothing and the symbol is mapped on the next run', async () => {
                const shared = newShared();
                let calls = 0;
                const profiles = { [BAD]: profile({ cusip: '037833100' }) };
                const flaky = {
                    fetchProfile: async () => {
                        calls += 1;
                        if (calls === 1) throw new Error('503');
                        return profile({ cusip: '037833100' });
                    },
                };
                const first = build(profiles, flaky, {}, [], shared);
                const r1 = await runCusipMapSync(first.deps);
                expect(r1).toMatchObject({ errors: 1, failuresMarked: 0 });
                expect(shared.failMarked.size).toBe(0);
                shared.day = 1;
                const second = build(profiles, flaky, {}, [], shared);
                expect((await runCusipMapSync(second.deps)).fromProfile).toBe(
                    1
                );
                shared.day = 2;
                const third = build(profiles, flaky, {}, [], shared);
                expect(await runCusipMapSync(third.deps)).toMatchObject({
                    candidates: 0,
                    universeCompleted: true,
                });
            });

            const figiOnly = {
                [BAD]: profile({ isin: 'US0378331005' }),
            };

            it('an OpenFIGI outage that persists marks the FIGI candidates after the threshold and the marker is then set', async () => {
                const shared = newShared();
                const down = {
                    mapCusipsToTickers: async () => {
                        throw new Error('openfigi 500');
                    },
                };
                for (let day = 0; day < FAIL; day += 1) {
                    shared.day = day;
                    const { deps } = build(figiOnly, down, {}, [], shared);
                    const r = await runCusipMapSync(deps);
                    expect(r.candidates).toBe(1);
                    expect(r.universeCompleted).toBe(false);
                }
                expect(shared.failMarked.has(BAD)).toBe(true);
                shared.day = FAIL;
                const { deps } = build(figiOnly, down, {}, [], shared);
                expect(await runCusipMapSync(deps)).toMatchObject({
                    candidates: 0,
                    universeCompleted: true,
                });
            });

            it('an OpenFIGI rate limit is not counted as a failure (never marks, however long it lasts)', async () => {
                const shared = newShared();
                const limited = {
                    mapCusipsToTickers: async () => {
                        throw new Error('429');
                    },
                };
                for (let day = 0; day < FAIL + 2; day += 1) {
                    shared.day = day;
                    const { deps } = build(figiOnly, limited, {}, [], shared);
                    await runCusipMapSync(deps);
                }
                expect(shared.failMarked.size).toBe(0);
                expect(shared.failCounts.size).toBe(0);
            });

            it('a transient OpenFIGI failure is retried: one outage day marks nothing and the next run verifies the symbol', async () => {
                const shared = newShared();
                const down = build(
                    figiOnly,
                    {
                        mapCusipsToTickers: async () => {
                            throw new Error('openfigi 503');
                        },
                    },
                    {},
                    [],
                    shared
                );
                await runCusipMapSync(down.deps);
                expect(shared.failMarked.size).toBe(0);
                shared.day = 1;
                const up = build(
                    figiOnly,
                    {},
                    { '037833100': [BAD] },
                    [],
                    shared
                );
                const r = await runCusipMapSync(up.deps);
                expect(r.fromFigi).toBe(1);
            });
        });

        it('stays set forever: later partial runs and new listings neither clear nor rewrite it', async () => {
            const first = build({});
            await runCusipMapSync(first.deps);
            const stamp = first.state.get(KEY);
            expect(stamp).toBeDefined();

            // a new listing appears -> candidates > 0 -> a later run on the same state
            const second = build(
                { NEWCO: profile({ cusip: '999999109' }) },
                { now: () => new Date('2026-11-01T00:00:00Z') }
            );
            second.state.set(KEY, stamp as string);
            const result = await runCusipMapSync(second.deps);
            expect(result.candidates).toBe(1);
            expect(second.state.get(KEY)).toBe(stamp);

            // and a later zero-candidate run does not rewrite it nor report a new completion
            const third = build(
                {},
                { now: () => new Date('2026-12-01T00:00:00Z') }
            );
            third.state.set(KEY, stamp as string);
            const again = await runCusipMapSync(third.deps);
            expect(again.universeCompleted).toBe(false);
            expect(third.state.get(KEY)).toBe(stamp);
        });
    });

    it('stores the FMP profile cusip with source fmp', async () => {
        const { deps, written } = build({
            AAPL: profile({ cusip: '037833100' }),
        });
        const result = await runCusipMapSync(deps);
        expect(written).toEqual([
            { cusip: '037833100', symbol: 'AAPL', source: 'fmp' },
        ]);
        expect(result).toMatchObject({
            fromProfile: 1,
            candidates: 1,
            status: 'complete',
        });
    });

    describe('ISIN fallback verified by OpenFIGI', () => {
        it('stores an ISIN-derived CUSIP as source openfigi only when FIGI resolves it to the same ticker', async () => {
            const { deps, written } = build(
                { AAPL: profile({ isin: 'US0378331005' }) },
                {},
                { '037833100': ['AAPL'] }
            );
            const result = await runCusipMapSync(deps);
            expect(written).toEqual([
                { cusip: '037833100', symbol: 'AAPL', source: 'openfigi' },
            ]);
            expect(result.fromFigi).toBe(1);
        });

        it('rejects the candidate when FIGI says it belongs to a different ticker, and marks a miss', async () => {
            const { deps, written, missRecords } = build(
                { AAPL: profile({ isin: 'US0378331005' }) },
                {},
                { '037833100': ['MSFT'] }
            );
            await runCusipMapSync(deps);
            expect(written).toEqual([]);
            expect(missRecords).toEqual([
                { symbol: 'AAPL', ttlSeconds: MISS_TTL_SECONDS.figiMismatch },
            ]);
        });

        it('leaves unresolved candidates unmarked for the next run (e.g. deadline during FIGI)', async () => {
            const { deps, missRecords } = build(
                { AAPL: profile({ isin: 'US0378331005' }) },
                { mapCusipsToTickers: async () => new Map() }
            );
            await runCusipMapSync(deps);
            expect(missRecords).toEqual([]);
        });

        it('keeps the FMP results when OpenFIGI fails or is rate limited', async () => {
            const { deps, written } = build(
                {
                    AAPL: profile({ cusip: '037833100' }),
                    MSFT: profile({ isin: 'US5949181045' }),
                },
                {
                    mapCusipsToTickers: async () => {
                        throw new Error('429');
                    },
                }
            );
            const result = await runCusipMapSync(deps);
            expect(written.map(r => r.symbol)).toEqual(['AAPL']);
            expect(result.status).toBe('complete');
        });
    });

    describe('exclusions recorded as misses', () => {
        it('marks ETFs and funds as not common stock', async () => {
            const { deps, written, missRecords } = build({
                SPY: profile({ cusip: '78462F103', isEtf: true }),
                VFINX: profile({ cusip: '922908108', isFund: true }),
            });
            await runCusipMapSync(deps);
            expect(written).toEqual([]);
            expect(missRecords).toEqual([
                { symbol: 'SPY', ttlSeconds: MISS_TTL_SECONDS.notCommonStock },
                {
                    symbol: 'VFINX',
                    ttlSeconds: MISS_TTL_SECONDS.notCommonStock,
                },
            ]);
        });

        it('marks an empty profile and a profile without any identifier', async () => {
            const { deps, missRecords } = build({
                GONE: null,
                NOID: profile(),
            });
            await runCusipMapSync(deps);
            expect(missRecords).toEqual([
                { symbol: 'GONE', ttlSeconds: MISS_TTL_SECONDS.noProfile },
                { symbol: 'NOID', ttlSeconds: MISS_TTL_SECONDS.noCusip },
            ]);
        });

        it('skips symbols with a recent miss entirely (no FMP call)', async () => {
            const { deps, fetched } = build(
                {
                    AAPL: profile({ cusip: '037833100' }),
                    SPY: profile({ isEtf: true }),
                },
                {},
                {},
                ['SPY']
            );
            await runCusipMapSync(deps);
            expect(fetched).toEqual(['AAPL']);
        });
    });

    describe('failures and limits', () => {
        it('counts a transient FMP error but does not mark a miss (retry next run) and continues', async () => {
            const { deps, written, missRecords } = build({
                AAA: new Error('boom'),
                BBB: profile({ cusip: '594918104' }),
            });
            const result = await runCusipMapSync(deps);
            expect(result.errors).toBe(1);
            expect(missRecords).toEqual([]);
            expect(written.map(r => r.symbol)).toEqual(['BBB']);
        });

        it('stops the run on an FMP rate limit', async () => {
            const names = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'];
            const profiles = Object.fromEntries(
                names.map(n => [n, profile({ cusip: '594918104' })])
            );
            profiles.AAA = new Error('429') as never;
            const { deps, fetched } = build(profiles);
            const result = await runCusipMapSync(deps);
            expect(result.status).toBe('rate_limited');
            expect(fetched).toHaveLength(3); // the first chunk only
        });

        it('stops at the deadline and reports it', async () => {
            const { deps, fetched } = build(
                { AAA: profile({ cusip: '594918104' }) },
                { isDeadlineReached: () => true }
            );
            const result = await runCusipMapSync(deps);
            expect(result.status).toBe('deadline');
            expect(fetched).toEqual([]);
        });

        it('caps the symbols attempted per run and reports capped', async () => {
            const profiles = Object.fromEntries(
                Array.from({ length: MAX_SYMBOLS_PER_RUN + 10 }, (_, i) => [
                    `S${String(i).padStart(5, '0')}`,
                    profile({ cusip: '594918104' }),
                ])
            );
            const { deps, fetched } = build(profiles);
            const result = await runCusipMapSync(deps);
            expect(result.status).toBe('capped');
            expect(fetched).toHaveLength(MAX_SYMBOLS_PER_RUN);
        });
    });

    describe('re-checking existing mappings (CUSIP changes)', () => {
        const candidate = (
            id: number,
            symbol: string,
            cusip: string
        ): RecheckCandidate => ({ id, symbol, cusip });

        it('records a changed profile CUSIP as a NEW mapping (new created_at => no baseline for the new CUSIP) and leaves the old row alone', async () => {
            const { deps, written, recheck } = build({});
            recheck.candidates = [candidate(7, 'AAPL', '037833100')];
            const { deps: d2 } = { deps };
            d2.fetchProfile = async () => profile({ cusip: '594918104' });
            const result = await runCusipMapSync(d2);
            expect(written).toEqual([
                { cusip: '594918104', symbol: 'AAPL', source: 'fmp' },
            ]);
            expect(result).toMatchObject({ rechecked: 1, cusipChanged: 1 });
            expect(recheck.checked).toEqual([7]);
        });

        it('does nothing when the profile CUSIP still matches (only checked_at advances)', async () => {
            const { deps, written, recheck } = build({});
            recheck.candidates = [candidate(7, 'AAPL', '037833100')];
            deps.fetchProfile = async () => profile({ cusip: '037833100' });
            const result = await runCusipMapSync(deps);
            expect(written).toEqual([]);
            expect(result).toMatchObject({ rechecked: 1, cusipChanged: 0 });
            expect(recheck.checked).toEqual([7]);
        });

        it('does not create a duplicate when the new CUSIP is already mapped (old/new pair re-checked)', async () => {
            const { deps, written, recheck } = build({});
            recheck.candidates = [candidate(7, 'AAPL', '037833100')];
            recheck.existing = ['594918104'];
            deps.fetchProfile = async () => profile({ cusip: '594918104' });
            const result = await runCusipMapSync(deps);
            expect(written).toEqual([]);
            expect(result.cusipChanged).toBe(0);
        });

        it('ignores a profile without a usable CUSIP but still advances checked_at', async () => {
            const { deps, written, recheck } = build({});
            recheck.candidates = [
                candidate(7, 'AAPL', '037833100'),
                candidate(8, 'MSFT', '594918104'),
            ];
            deps.fetchProfile = async symbol =>
                symbol === 'AAPL' ? null : profile({ cusip: null });
            await runCusipMapSync(deps);
            expect(written).toEqual([]);
            expect(recheck.checked).toEqual([7, 8]);
        });

        it('leaves a mapping unchecked when the FMP lookup fails (it is retried next run) and counts the error', async () => {
            const { deps, recheck } = build({});
            recheck.candidates = [candidate(7, 'AAPL', '037833100')];
            deps.fetchProfile = async () => {
                throw new Error('boom');
            };
            const result = await runCusipMapSync(deps);
            expect(recheck.checked).toEqual([]);
            expect(result.errors).toBe(1);
        });

        it('does not refetch a profile it mapped earlier in the same run, but marks that mapping checked', async () => {
            const { deps, fetched, recheck } = build({
                AAA: profile({ cusip: '594918104' }),
            });
            // The new row (checked_at NULL) comes back first, next to an older mapping.
            recheck.candidates = [
                candidate(9, 'AAA', '594918104'),
                candidate(7, 'AAPL', '037833100'),
            ];
            const result = await runCusipMapSync(deps);
            expect(fetched.filter(symbol => symbol === 'AAA')).toHaveLength(1);
            expect(fetched).toContain('AAPL');
            expect(recheck.checked.toSorted()).toEqual([7, 9]);
            expect(result.rechecked).toBe(1);
        });

        it('still rechecks a mapping of the same symbol under a different CUSIP', async () => {
            const { deps, fetched, recheck } = build({
                AAA: profile({ cusip: '594918104' }),
            });
            recheck.candidates = [candidate(4, 'AAA', '037833100')];
            await runCusipMapSync(deps);
            expect(fetched.filter(symbol => symbol === 'AAA')).toHaveLength(2);
        });

        it('asks for only a small batch per run (no mass re-processing)', async () => {
            const { deps } = build({});
            const spy = vi.spyOn(deps.repo, 'listRecheckCandidates');
            await runCusipMapSync(deps);
            expect(spy).toHaveBeenCalledWith(
                INVESTOR_FLOWS_CUSIP_RECHECK_BATCH
            );
            expect(INVESTOR_FLOWS_CUSIP_RECHECK_BATCH).toBeLessThanOrEqual(100);
        });

        it('is skipped when the run already ended on a rate limit or the deadline', async () => {
            const { deps } = build(
                { AAA: profile({ cusip: '594918104' }) },
                { isDeadlineReached: () => true }
            );
            const spy = vi.spyOn(deps.repo, 'listRecheckCandidates');
            await runCusipMapSync(deps);
            expect(spy).not.toHaveBeenCalled();
        });
    });
});
