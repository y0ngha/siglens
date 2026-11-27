vi.mock('server-only', () => ({}));

const { barsCache, history } = vi.hoisted(() => ({
    barsCache: { get: vi.fn() },
    history: { load: vi.fn() },
}));
vi.mock('../../server/barsDataCache', () => ({
    getCachedBarsWithIndicators: barsCache.get,
}));
vi.mock('../../server/loadDailyCloseHistory', () => ({
    loadDailyCloseHistory: history.load,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    calendarPeriodChange,
    type Bar,
    type MarketDailyClose,
} from '@y0ngha/siglens-core';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    __resetFullHistoryMemoForTests,
    FULL_HISTORY_CONCURRENCY,
    FULL_HISTORY_WAIT_DEADLINE_MS,
    FullHistoryBusyError,
    loadIndexPriceStatsCloses,
    loadPriceStatsCloses,
} from '../../server/loadPriceStatsCloses';

const US = sessionSpecFor('us-equity');
const KR = sessionSpecFor('kr-equity');
const CRYPTO = sessionSpecFor('crypto');

/** 금요일 10:00 ET(장중). 마지막 마감 세션은 11-19(목). */
const OPEN = new Date('2026-11-20T15:00:00Z');
/** 금요일 22:00 ET(마감 + 게시 여유 뒤). 마지막 마감 세션은 11-20. */
const CLOSED = new Date('2026-11-21T03:00:00Z');

const bar = (date: string, close: number): Bar => ({
    time: Date.parse(`${date}T00:00:00Z`) / 1000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});
const full = (dates: string[]): MarketDailyClose[] =>
    dates.map((date, i) => ({ date, close: 100 + i }));

const baseInput = {
    symbol: 'AAPL',
    profile: 'us-equity' as const,
    session: US,
    assetKnown: true,
    earliestFor: (): string | null => '2026-01-01',
    now: CLOSED,
};

beforeEach(() => {
    barsCache.get.mockReset();
    history.load.mockReset();
    __resetFullHistoryMemoForTests();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(CLOSED);
});
afterEach(() => vi.useRealTimers());

describe('loadPriceStatsCloses — five-year cache path', () => {
    it('uses the cached series when it reaches the earliest date, with no new fetch', async () => {
        barsCache.get.mockResolvedValue({
            bars: [bar('2025-12-30', 90)],
            fearGreedBars: [
                bar('2025-12-31', 100),
                bar('2026-11-19', 120),
                bar('2026-11-20', 121),
            ],
        });
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => '2025-12-31',
        });
        expect(result).toEqual({
            closes: [
                { date: '2025-12-31', close: 100 },
                { date: '2026-11-19', close: 120 },
                { date: '2026-11-20', close: 121 },
            ],
            source: 'five_year_cache',
            sessionInProgress: false,
        });
        expect(history.load).not.toHaveBeenCalled();
    });

    it('falls back to the plain bars when there is no five-year series', async () => {
        barsCache.get.mockResolvedValue({
            bars: [bar('2025-12-31', 100), bar('2026-11-20', 121)],
        });
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => '2025-12-31',
        });
        expect(result?.closes).toHaveLength(2);
    });

    it('asks for the earliest date from the series actual last close', async () => {
        barsCache.get.mockResolvedValue({
            bars: [bar('2025-12-31', 100), bar('2026-11-18', 118)],
        });
        const earliestFor = vi.fn(() => '2025-12-31');
        await loadPriceStatsCloses({ ...baseInput, earliestFor });
        expect(earliestFor).toHaveBeenCalledWith('2026-11-18');
    });

    it('drops only the forming bar during the session', async () => {
        barsCache.get.mockResolvedValue({
            bars: [
                bar('2025-12-31', 100),
                bar('2026-11-19', 119),
                bar('2026-11-20', 999),
            ],
        });
        vi.setSystemTime(OPEN);
        const result = await loadPriceStatsCloses({
            ...baseInput,
            now: OPEN,
            earliestFor: () => '2025-12-31',
        });
        expect(result).toEqual({
            closes: [
                { date: '2025-12-31', close: 100 },
                { date: '2026-11-19', close: 119 },
            ],
            source: 'five_year_cache',
            sessionInProgress: true,
        });
    });

    it('US 17:00 ET (inside the EOD publish buffer) keeps the session that just closed, ending on the last bar like the bars tool', async () => {
        // Monday 17:00 ET: closed, but the last closed session by the publish buffer is still Friday 11-13.
        const buffer = new Date('2026-11-16T22:00:00Z');
        const bars = [
            bar('2025-12-31', 100),
            bar('2026-11-13', 113),
            bar('2026-11-16', 116),
        ];
        barsCache.get.mockResolvedValue({ bars });
        vi.setSystemTime(buffer);
        const result = await loadPriceStatsCloses({
            ...baseInput,
            now: buffer,
            earliestFor: () => '2025-12-31',
        });
        expect(result?.closes.at(-1)).toEqual({
            date: '2026-11-16',
            close: 116,
        });
        expect(result?.sessionInProgress).toBe(false);
        // The bars tool's calendarChange reads the same last bar: both print the same figure.
        expect(calendarPeriodChange(result?.closes ?? [], 1)).toEqual(
            calendarPeriodChange(
                bars.map(b => ({
                    date: new Date(b.time * 1000).toISOString().slice(0, 10),
                    close: b.close,
                })),
                1
            )
        );
    });

    it('KR 16:00 KST (after the 15:30 close, inside the buffer) keeps that day', async () => {
        const buffer = new Date('2026-11-16T07:00:00Z');
        barsCache.get.mockResolvedValue({
            bars: [bar('2025-12-30', 100), bar('2026-11-16', 116)],
        });
        vi.setSystemTime(buffer);
        const result = await loadPriceStatsCloses({
            ...baseInput,
            symbol: '005930.KS',
            profile: 'kr-equity',
            session: KR,
            now: buffer,
            earliestFor: () => '2025-12-30',
        });
        expect(result?.closes.at(-1)?.date).toBe('2026-11-16');
        expect(result?.sessionInProgress).toBe(false);
    });

    it('summer time (EDT): at 2026-07-06 11:00 KST the KR session is open and its bar is dropped, while the US market (Sunday 22:00 ET) has no forming bar', async () => {
        const edt = new Date('2026-07-06T02:00:00Z');
        vi.setSystemTime(edt);
        barsCache.get.mockResolvedValue({
            bars: [
                bar('2025-12-30', 100),
                bar('2026-07-02', 102),
                bar('2026-07-06', 999),
            ],
        });
        const kr = await loadPriceStatsCloses({
            ...baseInput,
            symbol: '005930.KS',
            profile: 'kr-equity',
            session: KR,
            now: edt,
            earliestFor: () => '2025-12-30',
        });
        expect(kr?.closes.map(c => c.date)).toEqual([
            '2025-12-30',
            '2026-07-02',
        ]);
        expect(kr?.sessionInProgress).toBe(true);
        barsCache.get.mockResolvedValue({
            bars: [bar('2025-12-30', 100), bar('2026-07-02', 102)],
        });
        const us = await loadPriceStatsCloses({
            ...baseInput,
            now: edt,
            earliestFor: () => '2025-12-30',
        });
        expect(us?.closes.at(-1)?.date).toBe('2026-07-02');
        expect(us?.sessionInProgress).toBe(false);
    });

    it('drops unusable prices so a date reads the same on both paths', async () => {
        barsCache.get.mockResolvedValue({
            bars: [
                bar('2025-12-31', 100),
                bar('2026-03-02', 0),
                bar('2026-11-19', Number.NaN),
                bar('2026-11-20', 121),
            ],
        });
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => '2025-12-31',
        });
        expect(result?.closes).toEqual([
            { date: '2025-12-31', close: 100 },
            { date: '2026-11-20', close: 121 },
        ]);
    });

    it('a 24-hour market is never reported as a session in progress', async () => {
        barsCache.get.mockResolvedValue({
            bars: [bar('2025-12-31', 100), bar('2026-11-19', 119)],
        });
        const result = await loadPriceStatsCloses({
            ...baseInput,
            symbol: 'BTCUSD',
            profile: 'crypto',
            session: CRYPTO,
            earliestFor: () => '2025-12-31',
        });
        expect(result?.sessionInProgress).toBe(false);
    });
});

describe('loadPriceStatsCloses — full history path', () => {
    // A full five-year window: it starts before the cache window's start, so it is not a whole listing history.
    const cached = {
        bars: [bar('2026-03-02', 100), bar('2026-11-20', 121)],
        fearGreedBars: [
            bar('2021-06-01', 90),
            bar('2026-03-02', 100),
            bar('2026-11-20', 121),
        ],
    };

    it('goes to the full history when the cache does not reach the earliest date', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockResolvedValue(full(['2010-01-04', '2026-11-20']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            fmpSymbol: 'BRK-B',
            earliestFor: () => '2016-11-20',
        });
        expect(result).toEqual({
            closes: full(['2010-01-04', '2026-11-20']),
            source: 'full_history',
            sessionInProgress: false,
        });
        expect(history.load).toHaveBeenCalledWith({
            symbol: 'BRK-B',
            source: 'fmp',
            session: US,
            now: CLOSED,
        });
    });

    it('goes to the full history for max (no earliest date)', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockResolvedValue(full(['2010-01-04']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => null,
        });
        expect(result?.source).toBe('full_history');
    });

    it('reads Korean stocks from Yahoo with the KRX session', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockResolvedValue(full(['2010-01-04']));
        await loadPriceStatsCloses({
            ...baseInput,
            symbol: '005930.KS',
            profile: 'kr-equity',
            session: KR,
            earliestFor: () => null,
        });
        expect(history.load).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: '005930.KS',
                source: 'yahoo',
                session: KR,
            })
        );
    });

    it('an empty full history is null', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockResolvedValue([]);
        await expect(
            loadPriceStatsCloses({ ...baseInput, earliestFor: () => null })
        ).resolves.toBeNull();
    });

    it('a provider failure propagates', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockRejectedValue(new Error('fmp down'));
        await expect(
            loadPriceStatsCloses({ ...baseInput, earliestFor: () => null })
        ).rejects.toThrow('fmp down');
    });

    it('appends the cached completed rows dated after the full history, so the buffer-window session is not lost', async () => {
        // Monday 17:00 ET: the full history stops at the last closed session (Friday 11-13), the cache has Monday's bar.
        const buffer = new Date('2026-11-16T22:00:00Z');
        vi.setSystemTime(buffer);
        barsCache.get.mockResolvedValue({
            bars: [],
            fearGreedBars: [
                bar('2021-06-01', 90),
                bar('2026-11-13', 113),
                bar('2026-11-16', 116),
            ],
        });
        history.load.mockResolvedValue([
            { date: '2010-01-04', close: 50 },
            { date: '2026-11-13', close: 113 },
        ]);
        const result = await loadPriceStatsCloses({
            ...baseInput,
            now: buffer,
            earliestFor: () => null,
        });
        expect(result?.source).toBe('full_history');
        expect(result?.closes.map(c => c.date)).toEqual([
            '2010-01-04',
            '2026-11-13',
            '2026-11-16',
        ]);
    });

    it('does not duplicate a date both the full history and the cache have', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockResolvedValue(full(['2010-01-04', '2026-11-20']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => null,
        });
        expect(result?.closes.map(c => c.date)).toEqual([
            '2010-01-04',
            '2026-11-20',
        ]);
    });

    it('does not attach the cached tail when the cache close on the join date differs (different basis)', async () => {
        const buffer = new Date('2026-11-16T22:00:00Z');
        vi.setSystemTime(buffer);
        barsCache.get.mockResolvedValue({
            bars: [],
            fearGreedBars: [
                bar('2021-06-01', 90),
                // e.g. split-adjusted in the cache but not in the full history: 113 vs 226 on the join date
                bar('2026-11-13', 113),
                bar('2026-11-16', 116),
            ],
        });
        history.load.mockResolvedValue([
            { date: '2010-01-04', close: 200 },
            { date: '2026-11-13', close: 226 },
        ]);
        const result = await loadPriceStatsCloses({
            ...baseInput,
            now: buffer,
            earliestFor: () => null,
        });
        expect(result?.closes.map(c => c.date)).toEqual([
            '2010-01-04',
            '2026-11-13',
        ]);
    });

    it('does not attach the tail when the cache has no row on the join date', async () => {
        const buffer = new Date('2026-11-16T22:00:00Z');
        vi.setSystemTime(buffer);
        barsCache.get.mockResolvedValue({
            bars: [],
            fearGreedBars: [bar('2021-06-01', 90), bar('2026-11-16', 116)],
        });
        history.load.mockResolvedValue(full(['2010-01-04', '2026-11-13']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            now: buffer,
            earliestFor: () => null,
        });
        expect(result?.closes.at(-1)?.date).toBe('2026-11-13');
    });

    it('drops unusable prices from the full history too', async () => {
        barsCache.get.mockResolvedValue(cached);
        history.load.mockResolvedValue([
            { date: '2010-01-04', close: 0 },
            { date: '2010-01-05', close: 10 },
            { date: '2026-11-19', close: Number.NaN },
            { date: '2026-11-20', close: 20 },
        ]);
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => null,
        });
        expect(result?.closes).toEqual([
            { date: '2010-01-05', close: 10 },
            { date: '2026-11-20', close: 20 },
        ]);
    });

    it('an empty cache for a known asset falls through to the full history instead of giving up', async () => {
        barsCache.get.mockResolvedValue({ bars: [] });
        history.load.mockResolvedValue(full(['2010-01-04']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => null,
        });
        expect(result?.source).toBe('full_history');
    });

    describe('unknown symbols', () => {
        const unknown = {
            ...baseInput,
            symbol: 'TYPO',
            assetKnown: false,
            earliestFor: () => null,
        };
        it('an unrecognised asset with an empty cache is null without any full-history read', async () => {
            barsCache.get.mockResolvedValue({ bars: [] });
            await expect(loadPriceStatsCloses(unknown)).resolves.toBeNull();
            expect(history.load).not.toHaveBeenCalled();
        });

        it('remembers it for a few minutes without touching the cache again, then asks again', async () => {
            barsCache.get.mockResolvedValue({ bars: [] });
            await loadPriceStatsCloses(unknown);
            vi.setSystemTime(new Date(CLOSED.getTime() + 4 * 60_000));
            await loadPriceStatsCloses(unknown);
            expect(barsCache.get).toHaveBeenCalledTimes(1);
            vi.setSystemTime(new Date(CLOSED.getTime() + 6 * 60_000));
            await loadPriceStatsCloses(unknown);
            expect(barsCache.get).toHaveBeenCalledTimes(2);
        });

        it('an unrecognised asset whose cache read threw still tries the long path and remembers nothing', async () => {
            const warn = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => undefined);
            barsCache.get.mockRejectedValue(new Error('redis down'));
            history.load.mockResolvedValue(full(['2010-01-04']));
            const first = await loadPriceStatsCloses(unknown);
            expect(first?.source).toBe('full_history');
            expect(history.load).toHaveBeenCalledTimes(1);
            // Nothing was memoized as unknown: the next call reads the cache again.
            await loadPriceStatsCloses(unknown);
            expect(barsCache.get).toHaveBeenCalledTimes(2);
            warn.mockRestore();
        });

        it('an unrecognised asset whose cache has bars still reads normally', async () => {
            barsCache.get.mockResolvedValue({
                bars: [],
                fearGreedBars: [bar('2024-01-02', 50), bar('2026-11-20', 121)],
            });
            const result = await loadPriceStatsCloses(unknown);
            expect(result?.source).toBe('five_year_cache');
        });
    });

    it('a cache read failure falls through to the full history and logs only the error name', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        barsCache.get.mockRejectedValue(new Error('redis down'));
        history.load.mockResolvedValue(full(['2010-01-04']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => '2016-11-20',
        });
        expect(result?.source).toBe('full_history');
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('five-year cache read failed'),
            { errorName: 'Error' }
        );
        warn.mockRestore();
    });

    it('nothing in the cache and nothing in the full history is null', async () => {
        barsCache.get.mockResolvedValue({ bars: [] });
        history.load.mockResolvedValue([]);
        await expect(
            loadPriceStatsCloses({ ...baseInput, earliestFor: () => null })
        ).resolves.toBeNull();
    });

    it('a listing younger than the cache window uses the cache for max: it already holds the whole history', async () => {
        barsCache.get.mockResolvedValue({
            bars: [],
            fearGreedBars: [bar('2024-01-02', 50), bar('2026-11-20', 121)],
        });
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => null,
        });
        expect(result?.source).toBe('five_year_cache');
        expect(history.load).not.toHaveBeenCalled();
    });

    it('a series that starts at the cache window start is not a whole history: max goes to the full history', async () => {
        barsCache.get.mockResolvedValue({
            bars: [],
            fearGreedBars: [bar('2021-06-01', 50), bar('2026-11-20', 121)],
        });
        history.load.mockResolvedValue(full(['2010-01-04', '2026-11-20']));
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => null,
        });
        expect(result?.source).toBe('full_history');
    });

    describe('full history concurrency', () => {
        const gateFor = () =>
            Array.from({ length: 5 }, () =>
                Promise.withResolvers<MarketDailyClose[]>()
            );
        const loadAll = (symbols: string[]) =>
            symbols.map(symbol =>
                loadPriceStatsCloses({
                    ...baseInput,
                    symbol,
                    earliestFor: () => null,
                })
            );

        it('runs at most FULL_HISTORY_CONCURRENCY loads at once and finishes the rest as slots free up', async () => {
            barsCache.get.mockResolvedValue(cached);
            const gates = gateFor();
            const started = { symbols: [] as string[] };
            history.load.mockImplementation((input: { symbol: string }) => {
                started.symbols = [...started.symbols, input.symbol];
                return gates[Number(input.symbol.slice(1))]?.promise;
            });
            const loads = loadAll(['S0', 'S1', 'S2', 'S3']);
            await vi.waitFor(() =>
                expect(started.symbols).toHaveLength(FULL_HISTORY_CONCURRENCY)
            );
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(started.symbols).toHaveLength(FULL_HISTORY_CONCURRENCY);
            gates.forEach(gate => gate.resolve(full(['2010-01-04'])));
            const results = await Promise.all(loads);
            expect(results.every(r => r?.source === 'full_history')).toBe(true);
            expect(started.symbols.toSorted()).toEqual([
                'S0',
                'S1',
                'S2',
                'S3',
            ]);
        });

        it('a fast load never waits behind a slow one while a slot is free (A slow, B C D fast)', async () => {
            barsCache.get.mockResolvedValue(cached);
            const gates = gateFor();
            const started = { symbols: [] as string[] };
            history.load.mockImplementation((input: { symbol: string }) => {
                started.symbols = [...started.symbols, input.symbol];
                return gates[Number(input.symbol.slice(1))]?.promise;
            });
            // S0 (A) is slow and stays pending to the end; S1..S3 (B, C, D) are fast.
            const [a, ...fast] = loadAll(['S0', 'S1', 'S2', 'S3']);
            await vi.waitFor(() => expect(started.symbols).toHaveLength(2));
            gates[1]?.resolve(full(['2010-01-04']));
            await vi.waitFor(() => expect(started.symbols).toContain('S2'));
            gates[2]?.resolve(full(['2010-01-04']));
            await vi.waitFor(() => expect(started.symbols).toContain('S3'));
            gates[3]?.resolve(full(['2010-01-04']));
            const results = await Promise.all(fast);
            expect(results.every(r => r?.source === 'full_history')).toBe(true);
            // A has not finished: the others got through the other slot.
            gates[0]?.resolve(full(['2010-01-04']));
            await expect(a).resolves.toMatchObject({ source: 'full_history' });
        });

        it('a load that waits longer than the deadline fails with FullHistoryBusyError and never starts', async () => {
            vi.useFakeTimers({
                toFake: ['Date', 'setTimeout', 'clearTimeout'],
            });
            vi.setSystemTime(CLOSED);
            barsCache.get.mockResolvedValue(cached);
            const gates = gateFor();
            const started = { symbols: [] as string[] };
            history.load.mockImplementation((input: { symbol: string }) => {
                started.symbols = [...started.symbols, input.symbol];
                return gates[Number(input.symbol.slice(1))]?.promise;
            });
            const [s0, s1, s2] = loadAll(['S0', 'S1', 'S2']);
            const rejected =
                expect(s2).rejects.toBeInstanceOf(FullHistoryBusyError);
            await vi.advanceTimersByTimeAsync(
                FULL_HISTORY_WAIT_DEADLINE_MS + 1
            );
            await rejected;
            expect(started.symbols.toSorted()).toEqual(['S0', 'S1']);
            // The timed-out waiter left the queue: a slot freed later is not handed to it.
            gates[0]?.resolve(full(['2010-01-04']));
            gates[1]?.resolve(full(['2010-01-04']));
            await Promise.all([s0, s1]);
            expect(started.symbols.toSorted()).toEqual(['S0', 'S1']);
        });

        it('a load that gets a slot before the deadline is not failed afterwards', async () => {
            vi.useFakeTimers({
                toFake: ['Date', 'setTimeout', 'clearTimeout'],
            });
            vi.setSystemTime(CLOSED);
            barsCache.get.mockResolvedValue(cached);
            const gates = gateFor();
            history.load.mockImplementation(
                (input: { symbol: string }) =>
                    gates[Number(input.symbol.slice(1))]?.promise
            );
            const [s0, s1, s2] = loadAll(['S0', 'S1', 'S2']);
            await vi.advanceTimersByTimeAsync(1_000);
            gates[0]?.resolve(full(['2010-01-04']));
            await vi.advanceTimersByTimeAsync(0);
            gates[1]?.resolve(full(['2010-01-04']));
            gates[2]?.resolve(full(['2010-01-04']));
            await vi.advanceTimersByTimeAsync(
                FULL_HISTORY_WAIT_DEADLINE_MS + 1
            );
            await expect(Promise.all([s0, s1, s2])).resolves.toHaveLength(3);
        });

        it('errors propagate and do not block the loads queued behind them', async () => {
            barsCache.get.mockResolvedValue(cached);
            history.load.mockImplementation(
                async (input: { symbol: string }) => {
                    if (input.symbol === 'S0') throw new Error('down');
                    return full(['2010-01-04']);
                }
            );
            const results = await Promise.allSettled(
                loadAll(['S0', 'S1', 'S2', 'S3', 'S4'])
            );
            expect(results.map(r => r.status)).toEqual([
                'rejected',
                'fulfilled',
                'fulfilled',
                'fulfilled',
                'fulfilled',
            ]);
            expect(results[0]).toMatchObject({
                reason: expect.objectContaining({ message: 'down' }),
            });
        });
    });

    describe('memo', () => {
        const ask = () =>
            loadPriceStatsCloses({ ...baseInput, earliestFor: () => null });
        beforeEach(() => {
            barsCache.get.mockResolvedValue(cached);
            history.load.mockResolvedValue(full(['2010-01-04']));
        });

        it('serves a repeat from memory within the TTL', async () => {
            await ask();
            await ask();
            expect(history.load).toHaveBeenCalledTimes(1);
        });

        it('misses after the TTL', async () => {
            await ask();
            vi.setSystemTime(new Date(CLOSED.getTime() + 61 * 60_000));
            await loadPriceStatsCloses({
                ...baseInput,
                now: new Date(CLOSED.getTime() + 61 * 60_000),
                earliestFor: () => null,
            });
            expect(history.load).toHaveBeenCalledTimes(2);
        });

        it('misses when the last closed session date changes', async () => {
            await ask();
            // Monday 22:00 ET: the last closed session moves from Friday 11-20 to Monday 11-23.
            const monday = new Date('2026-11-24T03:00:00Z');
            vi.setSystemTime(monday);
            await loadPriceStatsCloses({
                ...baseInput,
                now: monday,
                earliestFor: () => null,
            });
            expect(history.load).toHaveBeenCalledTimes(2);
        });

        it('holds a history that reaches the last closed session for the full hour', async () => {
            history.load.mockResolvedValue(full(['2010-01-04', '2026-11-20']));
            await ask();
            vi.setSystemTime(new Date(CLOSED.getTime() + 59 * 60_000));
            await ask();
            expect(history.load).toHaveBeenCalledTimes(1);
        });

        it('holds a history that stops before the last closed session only briefly', async () => {
            history.load.mockResolvedValue(full(['2010-01-04', '2026-11-19']));
            await ask();
            vi.setSystemTime(new Date(CLOSED.getTime() + 4 * 60_000));
            await ask();
            expect(history.load).toHaveBeenCalledTimes(1);
            vi.setSystemTime(new Date(CLOSED.getTime() + 6 * 60_000));
            await ask();
            expect(history.load).toHaveBeenCalledTimes(2);
        });

        it('keys by provider symbol, so another symbol is a separate read', async () => {
            await ask();
            await loadPriceStatsCloses({
                ...baseInput,
                symbol: 'MSFT',
                earliestFor: () => null,
            });
            expect(history.load).toHaveBeenCalledTimes(2);
        });

        it('does not store a rejection', async () => {
            history.load.mockRejectedValueOnce(new Error('fmp down'));
            await expect(ask()).rejects.toThrow('fmp down');
            await expect(ask()).resolves.toMatchObject({
                source: 'full_history',
            });
            expect(history.load).toHaveBeenCalledTimes(2);
        });

        it('does not store an empty history', async () => {
            history.load.mockResolvedValueOnce([]);
            await expect(ask()).resolves.toBeNull();
            await expect(ask()).resolves.not.toBeNull();
            expect(history.load).toHaveBeenCalledTimes(2);
        });

        it('folds concurrent identical requests into one load', async () => {
            const gate = Promise.withResolvers<MarketDailyClose[]>();
            history.load.mockReset();
            history.load.mockReturnValue(gate.promise);
            const first = ask();
            const second = ask();
            // Both callers must reach the full-history step before the load settles.
            await vi.waitFor(() =>
                expect(history.load).toHaveBeenCalledTimes(1)
            );
            gate.resolve(full(['2010-01-04']));
            const [a, b] = await Promise.all([first, second]);
            expect(a?.closes).toEqual(b?.closes);
            expect(history.load).toHaveBeenCalledTimes(1);
        });
    });
});

describe('loadIndexPriceStatsCloses', () => {
    it('reads the US indices from FMP with the US session and the index symbol', async () => {
        history.load.mockResolvedValue(full(['1950-01-03', '2026-11-20']));
        const result = await loadIndexPriceStatsCloses('sp500', CLOSED);
        expect(result).toEqual({
            closes: full(['1950-01-03', '2026-11-20']),
            source: 'full_history',
            sessionInProgress: false,
        });
        expect(history.load).toHaveBeenCalledWith({
            symbol: '^GSPC',
            source: 'fmp',
            session: US,
            now: CLOSED,
        });
        expect(barsCache.get).not.toHaveBeenCalled();
    });

    it('rounds index closes to 2 decimals without touching the memoized history', async () => {
        history.load.mockResolvedValue([
            { date: '2026-11-19', close: 4214.169921875 },
            { date: '2026-11-20', close: 4250.1 },
        ]);
        const first = await loadIndexPriceStatsCloses('sp500', CLOSED);
        expect(first?.closes).toEqual([
            { date: '2026-11-19', close: 4214.17 },
            { date: '2026-11-20', close: 4250.1 },
        ]);
        // Second call is a memo hit and rounds the same way (the stored rows were not mutated).
        const second = await loadIndexPriceStatsCloses('sp500', CLOSED);
        expect(history.load).toHaveBeenCalledTimes(1);
        expect(second?.closes[0]?.close).toBe(4214.17);
    });

    it('does not round stock closes', async () => {
        barsCache.get.mockResolvedValue({
            bars: [
                bar('2025-12-31', 100.123456),
                bar('2026-11-20', 121.987654),
            ],
        });
        const result = await loadPriceStatsCloses({
            ...baseInput,
            earliestFor: () => '2025-12-31',
        });
        expect(result?.closes.map(c => c.close)).toEqual([
            100.123456, 121.987654,
        ]);
    });

    it('reads the Korean indices from Yahoo with the KRX session', async () => {
        history.load.mockResolvedValue(full(['1996-12-11']));
        await loadIndexPriceStatsCloses('kospi', CLOSED);
        expect(history.load).toHaveBeenCalledWith({
            symbol: '^KS11',
            source: 'yahoo',
            session: KR,
            now: CLOSED,
        });
    });

    it('reports a session in progress while the market is open and null for an empty history', async () => {
        vi.setSystemTime(OPEN);
        history.load.mockResolvedValue(full(['2010-01-04']));
        const open = await loadIndexPriceStatsCloses('nasdaq', OPEN);
        expect(open?.sessionInProgress).toBe(true);
        history.load.mockResolvedValue([]);
        await expect(
            loadIndexPriceStatsCloses('kosdaq', OPEN)
        ).resolves.toBeNull();
    });
});
