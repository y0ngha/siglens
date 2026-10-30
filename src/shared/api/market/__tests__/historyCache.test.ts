import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { createMemoryLru } from '@/shared/cache/memoryLru';
import {
    HISTORY_MEMORY_TTL_CAP_SECONDS,
    readCachedHistory,
    type HistoryMemory,
} from '../historyCache';

const { getOrSetCache } = vi.hoisted(() => ({
    getOrSetCache: vi.fn(
        async (
            _key: string,
            _ttl: unknown,
            fetcher: () => Promise<unknown>
        ): Promise<unknown> => fetcher()
    ),
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

const BAR: Bar = {
    time: 1_767_312_000,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
};
const ALWAYS_FRESH = (): boolean => true;

describe('readCachedHistory', () => {
    let memory: HistoryMemory;
    beforeEach(() => {
        getOrSetCache.mockClear();
        memory = createMemoryLru(8);
    });

    it('serves a fresh L1 entry without touching the cache layer', async () => {
        memory.set('k', [BAR], 60_000);
        const fetcher = vi.fn(async () => []);
        expect(
            await readCachedHistory(
                memory,
                'k',
                () => 10,
                fetcher,
                ALWAYS_FRESH
            )
        ).toEqual([BAR]);
        expect(getOrSetCache).not.toHaveBeenCalled();
    });

    it('ignores an L1 entry the caller no longer considers fresh', async () => {
        memory.set('k', [BAR], 60_000);
        const fresher = { ...BAR, time: BAR.time + 86_400 };
        const result = await readCachedHistory(
            memory,
            'k',
            () => 10,
            async () => [fresher],
            bars => bars[0]?.time === fresher.time
        );
        expect(result).toEqual([fresher]);
    });

    it('stores a fetched non-empty result in L1', async () => {
        await readCachedHistory(
            memory,
            'k',
            () => 10,
            async () => [BAR],
            ALWAYS_FRESH
        );
        expect(memory.get('k')).toEqual([BAR]);
    });

    it('never stores an empty result in L1', async () => {
        await readCachedHistory(
            memory,
            'k',
            () => 10,
            async () => [],
            ALWAYS_FRESH
        );
        expect(memory.get('k')).toBeUndefined();
    });

    it('caps the L1 lifetime at the shared ceiling', async () => {
        const set = vi.fn();
        const spyMemory: HistoryMemory = { get: () => undefined, set };
        await readCachedHistory(
            spyMemory,
            'k',
            () => 86_400,
            async () => [BAR],
            ALWAYS_FRESH
        );
        expect(set).toHaveBeenCalledWith(
            'k',
            [BAR],
            HISTORY_MEMORY_TTL_CAP_SECONDS * MS_PER_SECOND
        );
        expect(HISTORY_MEMORY_TTL_CAP_SECONDS).toBe(30 * SECONDS_PER_MINUTE);
    });
});
