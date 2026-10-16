import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS,
    INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS,
    INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
import type { CikSymbolPair } from '../../lib/companyTickers';
import {
    runCikSymbolMapSync,
    type SyncCikSymbolMapDeps,
} from '../../server/syncCikSymbolMap';

const TODAY = '2026-10-16';
const SYMBOLS = Array.from(
    { length: INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS },
    (_, i) => `S${i}`
);
const TICKERS = Object.fromEntries(
    SYMBOLS.map((ticker, i) => [
        String(i),
        { cik_str: i + 1, ticker, title: ticker },
    ])
);

function build(
    scenario: { syncedOn?: string; gate?: boolean; json?: unknown } = {},
    over: Partial<SyncCikSymbolMapDeps> = {}
) {
    const state = new Map<string, string>();
    if (scenario.syncedOn !== undefined)
        state.set(INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED, scenario.syncedOn);
    if (scenario.gate !== false)
        state.set(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE, 'done');
    const calls = {
        fetched: 0,
        replaced: [] as (readonly CikSymbolPair[])[],
        logs: [] as string[],
    };
    const deps: SyncCikSymbolMapDeps = {
        fetchCompanyTickers: async () => {
            calls.fetched += 1;
            return scenario.json === undefined ? TICKERS : scenario.json;
        },
        repo: {
            getState: async key => state.get(key) ?? null,
            setState: async (key, value) => {
                state.set(key, value);
            },
            replaceCikSymbolMap: async pairs => {
                calls.replaced.push(pairs);
                return { upserted: pairs.length, deleted: 2 };
            },
        },
        loadUniverseSymbols: async () => SYMBOLS,
        isSecBlockedError: error =>
            error instanceof Error && error.message === 'blocked',
        now: () => new Date(`${TODAY}T03:10:00Z`),
        log: vi.fn((message: string) => {
            calls.logs.push(message);
        }),
        ...over,
    };
    return { deps, calls, state };
}

describe('runCikSymbolMapSync', () => {
    it('makes no request while the last sync is younger than the refresh interval', async () => {
        const { deps, calls } = build({
            syncedOn: addDays(
                TODAY,
                -(INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS - 1)
            ),
        });
        expect((await runCikSymbolMapSync(deps)).status).toBe('fresh');
        expect(calls.fetched).toBe(0);
    });

    it('refreshes once the interval has passed', async () => {
        const { deps, calls, state } = build({
            syncedOn: addDays(TODAY, -INVESTOR_FLOWS_CIK_MAP_REFRESH_DAYS),
        });
        expect(await runCikSymbolMapSync(deps)).toEqual({
            status: 'synced',
            pairs: INVESTOR_FLOWS_CIK_MAP_MIN_PAIRS,
            deleted: 2,
        });
        expect(calls.replaced[0]?.[0]).toEqual({ cik: 1, symbol: 'S0' });
        expect(state.get(INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED)).toBe(TODAY);
    });

    it('waits for the universe to be complete (a partial map would stick for a week)', async () => {
        const { deps, calls } = build({ gate: false });
        expect((await runCikSymbolMapSync(deps)).status).toBe(
            'universe_incomplete'
        );
        expect(calls.fetched).toBe(0);
    });

    it('does not replace the map with a suspiciously small result and does not mark it synced', async () => {
        const { deps, calls, state } = build({
            json: { 0: { cik_str: 1, ticker: 'S0' } },
        });
        expect(await runCikSymbolMapSync(deps)).toEqual({
            status: 'too_small',
            pairs: 1,
            deleted: 0,
        });
        expect(calls.replaced).toEqual([]);
        expect(state.has(INVESTOR_FLOWS_STATE_CIK_MAP_SYNCED)).toBe(false);
    });

    it('reports a missing file', async () => {
        const { deps } = build({ json: null });
        expect((await runCikSymbolMapSync(deps)).status).toBe('missing');
    });

    it('reports a SEC block without throwing', async () => {
        const { deps } = build(
            {},
            {
                fetchCompanyTickers: async () => {
                    throw new Error('blocked');
                },
            }
        );
        expect((await runCikSymbolMapSync(deps)).status).toBe('sec_blocked');
    });

    it('logs and reports any other failure without throwing (the CUSIP sync result stays in the run log)', async () => {
        const { deps, calls } = build(
            {},
            {
                fetchCompanyTickers: async () => {
                    throw new SyntaxError('Unexpected token');
                },
            }
        );
        expect((await runCikSymbolMapSync(deps)).status).toBe('failed');
        expect(calls.logs).toContain('[cusip-map] cik map sync failed:');
    });
});
