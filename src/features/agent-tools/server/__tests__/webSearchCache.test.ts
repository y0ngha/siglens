import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetWebSearchCacheForTests,
    getCachedSearch,
    searchCacheKey,
    setCachedSearch,
    shareInFlight,
    ttlMsFor,
} from '@/features/agent-tools/server/webSearchCache';

const base = {
    query: 'fed minutes',
    freshness: undefined as unknown,
    searchLang: 'en' as const,
    braveConfigured: true,
    naverConfigured: false,
};

describe('searchCacheKey', () => {
    it('normalises whitespace and ASCII case only', () => {
        expect(searchCacheKey({ ...base, query: '  Fed   MINUTES ' })).toBe(
            searchCacheKey(base)
        );
        // Hangul has no case, and non-ASCII letters are not folded.
        expect(searchCacheKey({ ...base, query: 'É' })).not.toBe(
            searchCacheKey({ ...base, query: 'é' })
        );
    });

    it('separates keys that differ only in freshness, search language or provider set', () => {
        const key = searchCacheKey(base);
        expect(searchCacheKey({ ...base, freshness: 'day' })).not.toBe(key);
        expect(searchCacheKey({ ...base, freshness: 'week' })).not.toBe(
            searchCacheKey({ ...base, freshness: 'day' })
        );
        expect(searchCacheKey({ ...base, searchLang: 'ko' })).not.toBe(key);
        expect(searchCacheKey({ ...base, braveConfigured: false })).not.toBe(
            key
        );
        expect(searchCacheKey({ ...base, naverConfigured: true })).not.toBe(
            key
        );
    });

    it('treats an unknown freshness value like no freshness', () => {
        expect(searchCacheKey({ ...base, freshness: 'year' })).toBe(
            searchCacheKey(base)
        );
        expect(searchCacheKey({ ...base, freshness: 42 })).toBe(
            searchCacheKey(base)
        );
    });
});

describe('transient cache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetWebSearchCacheForTests();
    });
    afterEach(() => vi.useRealTimers());

    it('keeps an entry for 15 minutes, and 5 minutes for freshness=day', () => {
        expect(ttlMsFor(undefined)).toBe(15 * 60_000);
        expect(ttlMsFor('week')).toBe(15 * 60_000);
        expect(ttlMsFor('day')).toBe(5 * 60_000);

        setCachedSearch('a', { v: 1 }, undefined);
        setCachedSearch('b', { v: 2 }, 'day');
        vi.advanceTimersByTime(5 * 60_000 - 1);
        expect(getCachedSearch('a')).toEqual({ v: 1 });
        expect(getCachedSearch('b')).toEqual({ v: 2 });
        vi.advanceTimersByTime(1);
        expect(getCachedSearch('b')).toBeUndefined();
        expect(getCachedSearch('a')).toEqual({ v: 1 });
        vi.advanceTimersByTime(10 * 60_000);
        expect(getCachedSearch('a')).toBeUndefined();
    });

    it('holds at most 200 entries, dropping the least recently used', () => {
        Array.from({ length: 201 }, (_, i) =>
            setCachedSearch(`k${i}`, i, undefined)
        );
        expect(getCachedSearch('k0')).toBeUndefined();
        expect(getCachedSearch('k1')).toBe(1);
        expect(getCachedSearch('k200')).toBe(200);
    });
});

describe('shareInFlight', () => {
    beforeEach(() => __resetWebSearchCacheForTests());

    it('runs one producer for concurrent identical keys and hands waiters the same value', async () => {
        const produce = vi.fn(async () => ({ n: 1 }));
        const [first, second] = await Promise.all([
            shareInFlight('k', produce),
            shareInFlight('k', produce),
        ]);
        expect(produce).toHaveBeenCalledTimes(1);
        expect(first).toEqual({ value: { n: 1 }, shared: false });
        expect(second).toEqual({ value: { n: 1 }, shared: true });
    });

    it('does not share across different keys', async () => {
        const produce = vi.fn(async () => 1);
        await Promise.all([
            shareInFlight('a', produce),
            shareInFlight('b', produce),
        ]);
        expect(produce).toHaveBeenCalledTimes(2);
    });

    it('forgets a finished call, including one that rejected', async () => {
        await expect(
            shareInFlight('k', async () => {
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');
        const produce = vi.fn(async () => 'again');
        expect(await shareInFlight('k', produce)).toEqual({
            value: 'again',
            shared: false,
        });
    });
});
