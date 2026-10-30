import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar, GetBarsOptions } from '@y0ngha/siglens-core';
import { createMemoryLru } from '@/shared/cache/memoryLru';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { getEodHistory } from '../eodHistoryCache';
import type { EodHistoryEntry, EodServeContext } from '../eodHistoryMerge';
import type { HistoryMemory } from '../historyCache';

const { store, getOrSetCache } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const getOrSetCache = vi.fn(
        async (
            key: string,
            _ttl: number | ((value: unknown) => number),
            fetcher: () => Promise<unknown>,
            shouldCache: (value: unknown) => boolean = () => true,
            isFresh: (value: unknown) => boolean = () => true
        ): Promise<unknown> => {
            if (store.has(key) && isFresh(store.get(key))) {
                return store.get(key);
            }
            const fetched = await fetcher();
            if (shouldCache(fetched)) store.set(key, fetched);
            return fetched;
        }
    );
    return { store, getOrSetCache };
});
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

const KEY = 'bars:eodhist:v3:AAPL';
const NOW_MS = Date.parse('2026-10-16T12:00:00Z');
const DAY_MS = SECONDS_PER_DAY * MS_PER_SECOND;

const secondsOf = (date: string): number =>
    Math.floor(Date.parse(`${date}T00:00:00Z`) / MS_PER_SECOND);
const bar = (date: string, open: number, close = open): Bar => ({
    time: secondsOf(date),
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume: 1,
});

const CTX: EodServeContext = {
    lastClosed: '2026-10-15',
    lastClosedThreshold: secondsOf('2026-10-15'),
    fetchFrom: '2026-10-01',
    nowMs: NOW_MS,
    cooldownMs: 4 * 60 * 60 * MS_PER_SECOND,
};
const OPTIONS: GetBarsOptions = { symbol: 'aapl', timeframe: '1Day' };

/** 직전 세션(10-14)까지 담긴 낡은 엔트리. */
const staleEntry = (): EodHistoryEntry => ({
    asOf: '2026-10-14',
    from: '2026-10-01',
    checkedAt: NOW_MS - DAY_MS,
    fullAt: NOW_MS - DAY_MS,
    bars: [
        bar('2026-10-12', 100),
        bar('2026-10-13', 100),
        bar('2026-10-14', 100),
    ],
});

describe('getEodHistory', () => {
    const getBars = vi.fn(async (_o: GetBarsOptions): Promise<Bar[]> => []);
    let memory: HistoryMemory;
    const read = (): Promise<Bar[]> =>
        getEodHistory({ getBars, memory }, OPTIONS, CTX);

    beforeEach(() => {
        store.clear();
        getOrSetCache.mockClear();
        getBars.mockReset();
        memory = createMemoryLru(8);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('fetches the whole fixed window on a cold cache and stores it under the v3 key for five days', async () => {
        getBars.mockResolvedValue([
            bar('2026-10-14', 100),
            bar('2026-10-15', 101),
        ]);
        await read();
        expect(getBars).toHaveBeenCalledTimes(1);
        expect(getBars).toHaveBeenCalledWith({
            ...OPTIONS,
            from: '2026-10-01',
            before: '2026-10-15',
        });
        expect(getOrSetCache.mock.calls[0]?.[0]).toBe(KEY);
        expect(getOrSetCache.mock.calls[0]?.[1]).toBe(432_000);
        expect(store.get(KEY)).toMatchObject({
            asOf: '2026-10-15',
            from: '2026-10-01',
            checkedAt: NOW_MS,
            fullAt: NOW_MS,
        });
    });

    it('serves a servable Redis entry without an upstream call', async () => {
        const entry: EodHistoryEntry = {
            ...staleEntry(),
            asOf: '2026-10-15',
            bars: [bar('2026-10-14', 100), bar('2026-10-15', 101)],
        };
        store.set(KEY, entry);
        expect(await read()).toEqual(entry.bars);
        expect(getBars).not.toHaveBeenCalled();
    });

    it('serves a servable L1 entry without touching the cache layer', async () => {
        const entry: EodHistoryEntry = {
            ...staleEntry(),
            asOf: '2026-10-15',
            bars: [bar('2026-10-15', 101)],
        };
        memory.set(KEY, entry, 60_000);
        expect(await read()).toEqual(entry.bars);
        expect(getOrSetCache).not.toHaveBeenCalled();
    });

    it('extends a stale entry incrementally from its last bar and keeps its fullAt', async () => {
        const stale = staleEntry();
        store.set(KEY, stale);
        getBars.mockResolvedValue([
            bar('2026-10-14', 100),
            bar('2026-10-15', 101),
        ]);
        const bars = await read();
        expect(getBars).toHaveBeenCalledTimes(1);
        expect(getBars).toHaveBeenCalledWith({
            ...OPTIONS,
            from: '2026-10-14',
            before: '2026-10-15',
        });
        expect(bars.map(b => b.time)).toEqual(
            ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map(
                secondsOf
            )
        );
        expect(store.get(KEY)).toMatchObject({
            asOf: '2026-10-15',
            checkedAt: NOW_MS,
            fullAt: stale.fullAt,
        });
    });

    it('refetches the whole window when the overlapping bar was adjusted', async () => {
        store.set(KEY, staleEntry());
        getBars
            .mockResolvedValueOnce([
                bar('2026-10-14', 50),
                bar('2026-10-15', 51),
            ])
            .mockResolvedValueOnce([
                bar('2026-10-14', 50),
                bar('2026-10-15', 51),
            ]);
        await read();
        expect(getBars).toHaveBeenCalledTimes(2);
        expect(getBars).toHaveBeenLastCalledWith({
            ...OPTIONS,
            from: '2026-10-01',
            before: '2026-10-15',
        });
        expect(store.get(KEY)).toMatchObject({ fullAt: NOW_MS });
        expect(console.warn).toHaveBeenCalledWith(
            '[CachedMarketDataProvider] eodhist overlap mismatch, full refetch:',
            'AAPL',
            'different'
        );
    });

    it('refetches the whole window when the overlapping bar is missing', async () => {
        store.set(KEY, staleEntry());
        getBars.mockResolvedValue([bar('2026-10-15', 101)]);
        await read();
        expect(getBars).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalledWith(
            '[CachedMarketDataProvider] eodhist overlap mismatch, full refetch:',
            'AAPL',
            'missing'
        );
    });

    it('refetches in full and resets fullAt to 0 when a new bar jumps from the cached close', async () => {
        store.set(KEY, staleEntry());
        getBars.mockResolvedValue([
            bar('2026-10-14', 100),
            bar('2026-10-15', 200),
        ]);
        await read();
        expect(getBars).toHaveBeenCalledTimes(2);
        expect(getBars).toHaveBeenLastCalledWith({
            ...OPTIONS,
            from: '2026-10-01',
            before: '2026-10-15',
        });
        expect(store.get(KEY)).toMatchObject({ fullAt: 0, checkedAt: NOW_MS });
        expect(console.warn).toHaveBeenCalledWith(
            '[CachedMarketDataProvider] eodhist price gap, full refetch:',
            'AAPL'
        );
    });

    it('does not cache or keep in L1 an empty result', async () => {
        getBars.mockResolvedValue([]);
        expect(await read()).toEqual([]);
        expect(store.has(KEY)).toBe(false);
        expect(memory.get(KEY)).toBeUndefined();
    });

    it('keeps a servable fetched entry in L1 for the next read', async () => {
        getBars.mockResolvedValue([
            bar('2026-10-14', 100),
            bar('2026-10-15', 101),
        ]);
        await read();
        getOrSetCache.mockClear();
        await read();
        expect(getOrSetCache).not.toHaveBeenCalled();
    });
});
