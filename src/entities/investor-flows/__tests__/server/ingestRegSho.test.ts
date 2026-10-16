import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_REG_SHO_BACKFILL_DAYS,
    INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS,
    INVESTOR_FLOWS_STATE_REG_SHO_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
import { parseRegShoCursor } from '../../lib/regShoCursor';
import {
    runRegShoIngest,
    type IngestRegShoDeps,
} from '../../server/ingestRegSho';
import type { RegShoThresholdRow } from '../../model';
import {
    CBOE_BZX_TH_20261015,
    NASDAQ_TH_20261015,
    NASDAQ_TH_NOT_PUBLISHED,
    NYSE_ARCA_TH_20261015,
} from '../fixtures/investorFlowsExpansionSamples';

const NOW = new Date('2026-10-16T05:00:00Z'); // Friday 05:00 UTC
const LAST = '2026-10-14';
const DEFAULT_CURSOR = JSON.stringify({
    lastByMarket: { nasdaq: LAST, nyse_arca: LAST, cboe_bzx: LAST },
    ingestedDates: [LAST],
});

/** Real lists on 2026-10-15; the 16th is not published yet (Nasdaq HTML, NYSE header + footer of another day, Cboe 404). */
const LISTS: Record<string, Record<string, string | null>> = {
    nasdaq: {
        '2026-10-15': NASDAQ_TH_20261015,
        '2026-10-16': NASDAQ_TH_NOT_PUBLISHED,
    },
    nyse_arca: {
        '2026-10-15': NYSE_ARCA_TH_20261015,
        '2026-10-16': NYSE_ARCA_TH_20261015,
    },
    cboe_bzx: { '2026-10-15': CBOE_BZX_TH_20261015, '2026-10-16': null },
};

interface Scenario {
    enabled?: boolean;
    gate?: boolean;
    cursor?: string | null;
    universe?: string[];
    lists?: Record<string, Record<string, string | null | Error>>;
}

function build(scenario: Scenario = {}, over: Partial<IngestRegShoDeps> = {}) {
    const state = new Map<string, string>();
    if (scenario.gate !== false)
        state.set(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE, 'done');
    const cursor =
        scenario.cursor === undefined ? DEFAULT_CURSOR : scenario.cursor;
    if (cursor !== null) state.set(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR, cursor);
    const calls = {
        fetched: [] as string[],
        rows: [] as RegShoThresholdRow[],
        prunes: [] as string[],
        invalidated: [] as string[][],
        stateReads: 0,
    };
    const deps: IngestRegShoDeps = {
        isEnabled: () => scenario.enabled !== false,
        markets: ['nasdaq', 'nyse_arca', 'cboe_bzx'],
        fetchList: async (market, date) => {
            calls.fetched.push(`${market}@${date}`);
            const value = (scenario.lists ?? LISTS)[market]?.[date];
            if (value instanceof Error) throw value;
            return value ?? null;
        },
        repo: {
            getState: async key => {
                calls.stateReads += 1;
                return state.get(key) ?? null;
            },
            setState: async (key, value) => {
                state.set(key, value);
            },
            insertListings: async rows => {
                calls.rows.push(...rows);
            },
            pruneBefore: async cutoff => {
                calls.prunes.push(cutoff);
                return 0;
            },
        },
        loadUniverseSymbols: async () =>
            scenario.universe ?? ['AMOD', 'XHB', 'ABUF', 'AAPL'],
        now: () => NOW,
        isDeadlineReached: () => false,
        invalidateSymbols: symbols => {
            calls.invalidated.push([...symbols]);
        },
        log: vi.fn(),
        ...over,
    };
    return { deps, calls, state };
}

describe('runRegShoIngest', () => {
    describe('when REG_SHO_THRESHOLD_DATA_ENABLED is off', () => {
        it('makes no request and touches no DB', async () => {
            const { deps, calls } = build({ enabled: false });
            expect(await runRegShoIngest(deps)).toMatchObject({
                status: 'disabled',
                listsFetched: 0,
            });
            expect(calls.fetched).toEqual([]);
            expect(calls.stateReads).toBe(0);
        });
    });

    it('does nothing before cusip-map finished its first full pass', async () => {
        const { deps, calls } = build({ gate: false });
        expect((await runRegShoIngest(deps)).status).toBe(
            'universe_incomplete'
        );
        expect(calls.fetched).toEqual([]);
    });

    it('does nothing with an empty universe', async () => {
        const { deps, calls } = build({ universe: [] });
        expect((await runRegShoIngest(deps)).status).toBe('empty_universe');
        expect(calls.fetched).toEqual([]);
    });

    describe('real lists of 2026-10-15', () => {
        it('stores the universe symbols listed per market', async () => {
            const { deps, calls } = build();
            const result = await runRegShoIngest(deps);
            expect(calls.rows).toEqual([
                { symbol: 'AMOD', tradeDate: '2026-10-15', market: 'nasdaq' },
                { symbol: 'XHB', tradeDate: '2026-10-15', market: 'nyse_arca' },
                { symbol: 'ABUF', tradeDate: '2026-10-15', market: 'cboe_bzx' },
            ]);
            expect(result).toMatchObject({
                status: 'ok',
                listsFetched: 3,
                rowsStored: 3,
            });
            expect(calls.invalidated).toEqual([['ABUF', 'AMOD', 'XHB']]);
        });

        it('resolves an exchange spelling of a class share to our symbol', async () => {
            const { deps, calls } = build({
                universe: ['BRK-B'],
                lists: {
                    nasdaq: {
                        '2026-10-15': NASDAQ_TH_20261015.replace(
                            'AMOD|',
                            'BRK.B|'
                        ),
                    },
                },
            });
            await runRegShoIngest(deps);
            expect(calls.rows).toEqual([
                { symbol: 'BRK-B', tradeDate: '2026-10-15', market: 'nasdaq' },
            ]);
        });

        it('treats the unpublished latest day as pending: the cursor stays on the last list it read', async () => {
            const { deps, state } = build();
            await runRegShoIngest(deps);
            const cursor = parseRegShoCursor(
                state.get(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR) ?? null
            );
            expect(cursor.lastByMarket).toEqual({
                nasdaq: '2026-10-15',
                nyse_arca: '2026-10-15',
                cboe_bzx: '2026-10-15',
            });
            expect(cursor.ingestedDates).toEqual([LAST, '2026-10-15']);
        });

        it('rejects the NYSE answer for a day whose footer names another date', async () => {
            const { deps, calls } = build();
            await runRegShoIngest(deps);
            expect(calls.rows.some(r => r.tradeDate === '2026-10-16')).toBe(
                false
            );
        });
    });

    it('steps over an old missing day as a holiday so the cursor never sticks on it', async () => {
        const { deps, state } = build({
            cursor: JSON.stringify({
                lastByMarket: {
                    nasdaq: '2026-10-09',
                    nyse_arca: LAST,
                    cboe_bzx: LAST,
                },
                ingestedDates: [],
            }),
            lists: {
                nasdaq: {
                    '2026-10-12': null,
                    '2026-10-13': NASDAQ_TH_20261015.replace(
                        '20261015230022',
                        '20261013230022'
                    ),
                },
                nyse_arca: {},
                cboe_bzx: {},
            },
        });
        const result = await runRegShoIngest(deps);
        expect(result.holidaysSkipped).toBe(2);
        // 10-12 (holiday) skipped, 10-13 read, 10-14 missing but old → holiday, 10-15 missing and recent → pending
        expect(
            parseRegShoCursor(
                state.get(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR) ?? null
            ).lastByMarket.nasdaq
        ).toBe('2026-10-14');
    });

    it('does not stall the Cboe cursor on a holiday (the client reads its AccessDenied 403 as no file)', async () => {
        // Thanksgiving 2025-11-27: Cboe has no file (the client returns null for its S3 AccessDenied 403)
        const thanksgiving = new Date('2025-12-02T05:00:00Z');
        const { deps, calls, state } = build(
            {
                cursor: JSON.stringify({
                    lastByMarket: { cboe_bzx: '2025-11-26' },
                    ingestedDates: [],
                }),
                lists: {
                    nasdaq: {},
                    nyse_arca: {},
                    cboe_bzx: {
                        '2025-11-27': null,
                        '2025-11-28': CBOE_BZX_TH_20261015.replace(
                            '20261015030524',
                            '20251128030524'
                        ),
                    },
                },
            },
            { now: () => thanksgiving, markets: ['cboe_bzx'] }
        );
        const result = await runRegShoIngest(deps);
        // 11-27 is stepped over as a holiday; 12-01 (no file yet, within the publication grace) stops the market
        expect(result.holidaysSkipped).toBe(1);
        expect(calls.rows.map(r => r.tradeDate)).toEqual(['2025-11-28']);
        expect(
            parseRegShoCursor(
                state.get(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR) ?? null
            ).lastByMarket.cboe_bzx
        ).toBe('2025-11-28');
    });

    it('calls onFirstListStored exactly once — on the run that ingests the first list, never on later runs', async () => {
        const onFirstListStored = vi.fn();
        const { deps } = build({ cursor: null }, { onFirstListStored });
        const first = await runRegShoIngest(deps);
        expect(first.firstListStored).toBe(true);
        expect(onFirstListStored).toHaveBeenCalledTimes(1);
        const second = await runRegShoIngest(deps);
        expect(second.firstListStored).toBe(false);
        expect(onFirstListStored).toHaveBeenCalledTimes(1);
    });

    it('does not call onFirstListStored when lists were already ingested before the run', async () => {
        const onFirstListStored = vi.fn();
        const { deps } = build({}, { onFirstListStored });
        const result = await runRegShoIngest(deps);
        expect(result.listsFetched).toBeGreaterThan(0);
        expect(onFirstListStored).not.toHaveBeenCalled();
    });

    it('does not call onFirstListStored while no list has been published yet', async () => {
        const onFirstListStored = vi.fn();
        const { deps } = build(
            {
                cursor: null,
                lists: { nasdaq: {}, nyse_arca: {}, cboe_bzx: {} },
            },
            { onFirstListStored }
        );
        expect((await runRegShoIngest(deps)).firstListStored).toBe(false);
        expect(onFirstListStored).not.toHaveBeenCalled();
    });

    it('backfills 60 days for a market without a cursor', async () => {
        const { deps, calls } = build({
            cursor: null,
            lists: { nasdaq: {}, nyse_arca: {}, cboe_bzx: {} },
        });
        await runRegShoIngest(deps);
        const start = addDays(
            '2026-10-16',
            -INVESTOR_FLOWS_REG_SHO_BACKFILL_DAYS
        );
        // 2026-08-17 is a Monday
        expect(calls.fetched[0]).toBe(`nasdaq@${start}`);
    });

    it('stops a market on an exchange error and keeps its cursor, while the other markets continue', async () => {
        const { deps, calls, state } = build({
            lists: {
                ...LISTS,
                nasdaq: { '2026-10-15': new Error('exchange 403') },
            },
        });
        const result = await runRegShoIngest(deps);
        expect(result.failedMarkets).toEqual(['nasdaq']);
        expect(calls.rows.map(r => r.market)).toEqual([
            'nyse_arca',
            'cboe_bzx',
        ]);
        expect(
            parseRegShoCursor(
                state.get(INVESTOR_FLOWS_STATE_REG_SHO_CURSOR) ?? null
            ).lastByMarket.nasdaq
        ).toBe(LAST);
    });

    it('stops at the deadline', async () => {
        const { deps, calls } = build({}, { isDeadlineReached: () => true });
        expect((await runRegShoIngest(deps)).status).toBe('deadline');
        expect(calls.fetched).toEqual([]);
    });

    it('prunes rows older than the retention', async () => {
        const { deps, calls } = build();
        await runRegShoIngest(deps);
        expect(calls.prunes).toEqual([
            addDays('2026-10-16', -INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS),
        ]);
    });
});
