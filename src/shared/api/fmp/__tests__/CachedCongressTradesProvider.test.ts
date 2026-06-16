import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedCongressTradesProvider } from '@/shared/api/fmp/CachedCongressTradesProvider';
import type {
    Chamber,
    CongressTradesProvider,
    RawCongressTrade,
} from '@y0ngha/siglens-core';
import { CONGRESS_REVALIDATE_SECONDS } from '@/shared/config/time';

// In-memory fake Redis mirroring the pattern in CachedFinancialStatementsProvider.test.ts.
// NOTE: react cache is a pass-through in vitest — second calls re-enter
// getOrSetCache, so fake-Redis hit logic is exercised.
const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(
            async (key: string, value: unknown, _options?: { ex?: number }) => {
                store.set(key, value);
            }
        ),
    };
    return { store, fakeRedis };
});

let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

function resetSharedState() {
    store.clear();
    redisEnabled = true;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
}

// RawCongressTrade has all fields as `unknown` — use a minimal fixture.
const SAMPLE_TRADE: RawCongressTrade = {
    transactionDate: '2024-01-15',
    disclosureDate: '2024-03-01',
    firstName: 'Jane',
    lastName: 'Doe',
    type: 'Purchase',
    amount: '$1,001 - $15,000',
};

function makeInner(
    overrides: Partial<CongressTradesProvider> = {}
): CongressTradesProvider {
    return {
        getTrades: vi.fn(async () => [SAMPLE_TRADE]),
        ...overrides,
    } as CongressTradesProvider;
}

describe('CachedCongressTradesProvider — cache key format & TTL', () => {
    beforeEach(resetSharedState);

    it('caches senate trades under congress:senate:<SYM> with correct TTL', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('aapl', 'senate', 10);

        expect(store.has('congress:senate:AAPL')).toBe(true);
        const setCall = fakeRedis.set.mock.calls[0];
        expect(setCall![0]).toBe('congress:senate:AAPL');
        // getOrSetCache stores as { data: value } — check the ex option
        expect((setCall![2] as { ex?: number }).ex).toBe(
            CONGRESS_REVALIDATE_SECONDS
        );
    });

    it('caches house trades under congress:house:<SYM>', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('MSFT', 'house', 10);

        expect(store.has('congress:house:MSFT')).toBe(true);
    });

    it('uppercases the symbol for the cache key (senate)', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('aapl', 'senate', 10);

        expect(store.has('congress:senate:AAPL')).toBe(true);
        expect(store.has('congress:senate:aapl')).toBe(false);
    });

    it('uppercases the symbol for the cache key (house)', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('nvda', 'house', 10);

        expect(store.has('congress:house:NVDA')).toBe(true);
        expect(store.has('congress:house:nvda')).toBe(false);
    });

    it('senate and house cache under separate keys for same symbol', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('AAPL', 'senate', 10);

        // Separate provider instance (new React.cache scope) for house
        const provider2 = new CachedCongressTradesProvider(inner);
        await provider2.getTrades('AAPL', 'house', 10);

        expect(store.has('congress:senate:AAPL')).toBe(true);
        expect(store.has('congress:house:AAPL')).toBe(true);
        expect(inner.getTrades).toHaveBeenCalledTimes(2);
    });
});

describe('CachedCongressTradesProvider — normal [] (0 trades) is cached', () => {
    beforeEach(resetSharedState);

    it('empty [] from inner is returned and cached — 0 trades is a normal state', async () => {
        const inner = makeInner({
            getTrades: vi.fn(async () => [] as RawCongressTrade[]),
        });
        const provider = new CachedCongressTradesProvider(inner);

        expect(await provider.getTrades('AAPL', 'senate', 10)).toEqual([]);
        expect(store.has('congress:senate:AAPL')).toBe(true);

        // Second call with a new provider (new React.cache scope): should hit
        // Redis and NOT call inner again
        const provider2 = new CachedCongressTradesProvider(inner);
        expect(await provider2.getTrades('AAPL', 'senate', 10)).toEqual([]);
        expect(inner.getTrades).toHaveBeenCalledTimes(1);
    });
});

describe('CachedCongressTradesProvider — inner throw must propagate (no poison cache)', () => {
    beforeEach(resetSharedState);

    it('senate: inner throw → getTrades REJECTS, does NOT cache', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 503');
        });
        const inner = makeInner({ getTrades: boom });
        const provider = new CachedCongressTradesProvider(inner);

        await expect(provider.getTrades('AAPL', 'senate', 10)).rejects.toThrow(
            'FMP 503'
        );

        // Failure must NOT be cached — no poison
        expect(store.has('congress:senate:AAPL')).toBe(false);

        // A new provider instance (new React.cache scope) must call inner again
        const provider2 = new CachedCongressTradesProvider(inner);
        await expect(provider2.getTrades('AAPL', 'senate', 10)).rejects.toThrow(
            'FMP 503'
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('house: inner throw → getTrades REJECTS, does NOT cache', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getTrades: boom });
        const provider = new CachedCongressTradesProvider(inner);

        await expect(provider.getTrades('TSLA', 'house', 10)).rejects.toThrow(
            'FMP 502'
        );

        expect(store.has('congress:house:TSLA')).toBe(false);

        // New provider → inner must be retried (no cached failure)
        const provider2 = new CachedCongressTradesProvider(inner);
        await expect(provider2.getTrades('TSLA', 'house', 10)).rejects.toThrow(
            'FMP 502'
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });
});

describe('CachedCongressTradesProvider — cache hit avoids inner call', () => {
    beforeEach(resetSharedState);

    it('second call for same symbol+chamber hits Redis, skips inner', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('AAPL', 'senate', 10);
        expect(inner.getTrades).toHaveBeenCalledTimes(1);

        // Second call: React.cache dedup within same instance
        await provider.getTrades('AAPL', 'senate', 10);
        expect(inner.getTrades).toHaveBeenCalledTimes(1);
    });

    it('new provider instance hits Redis (getOrSetCache dedup), skips inner', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        const result1 = await provider.getTrades('AAPL', 'senate', 10);
        expect(inner.getTrades).toHaveBeenCalledTimes(1);

        // New React.cache scope — goes through getOrSetCache which finds the
        // Redis hit and returns without calling inner
        const provider2 = new CachedCongressTradesProvider(inner);
        const result2 = await provider2.getTrades('AAPL', 'senate', 10);
        expect(result2).toEqual(result1);
        expect(inner.getTrades).toHaveBeenCalledTimes(1);
    });
});

describe('CachedCongressTradesProvider — Redis unavailable fallback', () => {
    beforeEach(resetSharedState);

    it('falls back to inner when Redis is disabled', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        const rows = await provider.getTrades('AAPL', 'senate', 10);
        expect(rows).toEqual([SAMPLE_TRADE]);
        expect(inner.getTrades).toHaveBeenCalledTimes(1);
        expect(store.size).toBe(0);
    });
});

describe('CachedCongressTradesProvider — chamber isolation', () => {
    beforeEach(resetSharedState);

    it('senate cache miss does not affect house key', async () => {
        const inner = makeInner();
        const provider = new CachedCongressTradesProvider(inner);

        await provider.getTrades('AAPL', 'senate', 10);
        expect(store.has('congress:senate:AAPL')).toBe(true);
        expect(store.has('congress:house:AAPL')).toBe(false);
    });
});
