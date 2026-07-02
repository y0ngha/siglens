import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CachedMarketDataProvider,
    secondsUntilNextEodRefresh,
} from '@/shared/api/market/CachedMarketDataProvider';
import {
    CRYPTO_SESSION,
    type Bar,
    type GetBarsOptions,
    type MarketQuote,
} from '@y0ngha/siglens-core';
import type { SiglensMarketProvider } from '@/shared/api/market/marketProvider.types';

/**
 * Captures the `ex` TTL passed to redis.set so we can assert that
 * `CachedMarketDataProvider` delegates to `computeBarsEffectiveTtl(timeframe, now, session)`
 * with the correct `MarketSessionSpec`:
 *   - crypto symbols → `CRYPTO_SESSION` (always-open, 24/7 uniform TTL)
 *   - equity symbols → `US_EQUITY_SESSION` (session-aware TTL, shorter during ET hours)
 */
const lastSetTtl: { value: number | undefined } = { value: undefined };

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(
            async (key: string, value: unknown, opts?: { ex?: number }) => {
                store.set(key, value);
                lastSetTtl.value = opts?.ex;
            }
        ),
    };
    return { store, fakeRedis };
});
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

/** Minimal bar factory for EOD split tests. */
const bar = (time: number): Bar => ({
    time,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
});

const SAMPLE_BARS: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
];
const SAMPLE_QUOTE: MarketQuote = {
    symbol: 'AAPL',
    price: 1.5,
    changesPercentage: 1.2,
    name: 'Apple',
};

function makeInner(
    overrides: Partial<SiglensMarketProvider> = {}
): SiglensMarketProvider {
    return {
        getBars: vi.fn(async () => SAMPLE_BARS),
        getQuote: vi.fn(async () => SAMPLE_QUOTE),
        getTodayBar: vi.fn(async () => null),
        ...overrides,
    } as SiglensMarketProvider;
}

/**
 * barsOpts defaults to '5Min' so the single-key (`bars:raw:*`) path is exercised —
 * '1Day' without `before` now goes through the EOD-split path (getCachedDailyBars).
 * Tests that specifically target 1Day caching live in the '1Day EOD split' describe block.
 */
const barsOpts = (o: Partial<GetBarsOptions> = {}): GetBarsOptions => ({
    symbol: 'aapl',
    timeframe: '5Min',
    from: '2026-01-01',
    ...o,
});

function reset() {
    store.clear();
    redisEnabled = true;
    lastSetTtl.value = undefined;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
}

/** Alias used by the EOD split tests (mirrors CachedFundamentalProvider naming). */
function resetSharedState() {
    reset();
}

describe('CachedMarketDataProvider', () => {
    beforeEach(reset);

    it('getBars: miss→fetch→set, hit→캐시값(키 bars:raw:SYM:TF:from:before:limit)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);

        const first = await p.getBars(barsOpts());
        expect(first).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::')).toBe(true);

        const second = await p.getBars(barsOpts());
        expect(second).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1);
    });

    it('getBars: 빈 배열은 캐싱하지 않는다(transient 가드)', async () => {
        const inner = makeInner({ getBars: vi.fn(async () => []) });
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getBars(barsOpts())).toEqual([]);
        expect(await p.getBars(barsOpts())).toEqual([]);
        expect(inner.getBars).toHaveBeenCalledTimes(2);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::')).toBe(false);
    });

    it('getBars: from/before/limit이 모두 undefined면 키에 빈 문자열로 채워진다 (?? 가드)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: undefined }));
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:5Min:::')).toBe(true);
    });

    it('getBars: from/before가 다르면 키가 분리된다', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: '2026-01-01' }));
        await p.getBars(barsOpts({ from: '2026-02-01' }));
        await p.getBars(barsOpts({ from: '2026-01-01', before: '2026-03-01' }));
        expect(inner.getBars).toHaveBeenCalledTimes(3);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::')).toBe(true);
        expect(store.has('bars:raw:AAPL:5Min:2026-02-01::')).toBe(true);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01:2026-03-01:')).toBe(
            true
        );
    });

    it('getBars: limit이 다르면 키가 분리된다 (옵션 확장 시 캐시 충돌 방지)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ limit: 100 }));
        await p.getBars(barsOpts({ limit: 200 }));
        expect(inner.getBars).toHaveBeenCalledTimes(2);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::100')).toBe(true);
        expect(store.has('bars:raw:AAPL:5Min:2026-01-01::200')).toBe(true);
    });

    it('getBars: inner throw는 전파되고 캐싱되지 않는다(worst case)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getBars: boom });
        const p = new CachedMarketDataProvider(inner);
        await expect(p.getBars(barsOpts())).rejects.toThrow('FMP 502');
        expect(store.size).toBe(0);
        await expect(p.getBars(barsOpts())).rejects.toThrow('FMP 502');
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getQuote: miss→fetch→set(quote:SYM), hit→캐시값, 심볼 대문자화', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        const first = await p.getQuote('aapl');
        expect(first).toEqual(SAMPLE_QUOTE);
        expect(inner.getQuote).toHaveBeenCalledTimes(1);
        expect(store.has('quote:AAPL')).toBe(true);
        await p.getQuote('aapl');
        expect(inner.getQuote).toHaveBeenCalledTimes(1);
    });

    it('getQuote: null(미가용)은 캐싱하지 않는다', async () => {
        const inner = makeInner({ getQuote: vi.fn(async () => null) });
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getQuote('NODATA')).toBeNull();
        expect(await p.getQuote('NODATA')).toBeNull();
        expect(inner.getQuote).toHaveBeenCalledTimes(2);
        expect(store.has('quote:NODATA')).toBe(false);
    });

    it('Redis 부재 시 inner로 fallback(worst case)', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getBars(barsOpts())).toEqual(SAMPLE_BARS);
        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);
        expect(store.size).toBe(0);
    });

    describe('1Day EOD split (quote-only today + daily 22:00 KST expiry)', () => {
        beforeEach(() => {
            resetSharedState();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-06-30T15:00:00Z'));
        });
        afterEach(() => vi.useRealTimers());

        const longOpts: GetBarsOptions = {
            symbol: 'AAPL',
            timeframe: '1Day',
            from: '2024-06-30',
        };

        // ── cold = 1 EOD (before=yesterday) + 1 getTodayBar ─────────────────
        it('cold: inner.getBars called once with before=yesterday, inner.getTodayBar called once; both keys written', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000)
            );

            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars(longOpts);

            // getBars called once with before=yesterday (2026-06-29)
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(getBars).toHaveBeenCalledWith(
                expect.objectContaining({ before: '2026-06-29' })
            );
            // getTodayBar called once
            expect(getTodayBar).toHaveBeenCalledTimes(1);
            expect(getTodayBar).toHaveBeenCalledWith('AAPL');
            // both cache keys written
            expect(store.has('bars:eodhist:AAPL')).toBe(true);
            expect(store.has('bars:today:AAPL')).toBe(true);
        });

        // ── repeat before 13:00 UTC = cache hit ──────────────────────────────
        it('repeat call before 13:00 UTC expiry = cache hit (no additional fetches)', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000)
            );

            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            // System time fixed at 2026-06-30T15:00:00Z (before next 13:00 UTC which is 2026-07-01T13:00:00Z)
            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(getTodayBar).toHaveBeenCalledTimes(1);

            // 2nd call same time — cache hit
            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(1); // still 1
            expect(getTodayBar).toHaveBeenCalledTimes(1); // still 1
        });

        // ── daily expiry: TTL value assertions ───────────────────────────────
        it('bars:eodhist TTL = secondsUntilNextEodRefresh(now) when now=12:00Z → ~3600s', () => {
            const now = new Date('2026-06-30T12:00:00Z');
            const ttl = secondsUntilNextEodRefresh(now);
            // next 13:00Z is same day: 13:00 - 12:00 = 3600s
            expect(ttl).toBe(3600);
        });

        it('bars:eodhist TTL = secondsUntilNextEodRefresh(now) when now=14:00Z → ~82800s', () => {
            const now = new Date('2026-06-30T14:00:00Z');
            const ttl = secondsUntilNextEodRefresh(now);
            // 13:00 already passed; next is 2026-07-01T13:00:00Z = 23h = 82800s
            expect(ttl).toBe(82800);
        });

        it('bars:eodhist TTL = secondsUntilNextEodRefresh(now) when now=exactly 13:00Z → 86400s (next day)', () => {
            const now = new Date('2026-06-30T13:00:00Z');
            const ttl = secondsUntilNextEodRefresh(now);
            // target == now → rolls to next day = 86400s
            expect(ttl).toBe(86400);
        });

        it('bars:eodhist set call gets TTL = secondsUntilNextEodRefresh at time of fetch', async () => {
            // now = 12:00Z → next 13:00Z is 3600s away
            vi.setSystemTime(new Date('2026-06-30T12:00:00Z'));
            resetSharedState();

            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars(longOpts);

            const histSetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('bars:eodhist')
            );
            expect(histSetCall).toBeDefined();
            expect(histSetCall![2]?.ex).toBe(3600);
        });

        it('daily expiry: simulating expiry by clearing key triggers refetch on next call', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars(longOpts); // cold fetch
            expect(getBars).toHaveBeenCalledTimes(1);

            // Simulate TTL expiry by clearing the cache key
            store.delete('bars:eodhist:AAPL');

            await provider.getBars(longOpts); // cache miss → refetch
            expect(getBars).toHaveBeenCalledTimes(2);
        });

        // ── covers/truncation: isFresh=false when oldest bar > from ──────────
        it('[truncation fix] shorter cache does not truncate a longer request → refetch', async () => {
            // 1st call: from='2025-06-30', oldest bar=2025-06-30 → covers OK → cached
            // 2nd call: from='2024-06-30', oldest bar=2025-06-30 > 2024-06-30 → covers FAIL → refetch
            const shortOldest = Math.floor(
                Date.parse('2025-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [
                { ...bar(shortOldest), time: shortOldest },
            ]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({ ...longOpts, from: '2025-06-30' });
            expect(getBars).toHaveBeenCalledTimes(1);

            await provider.getBars({ ...longOpts, from: '2024-06-30' });
            expect(getBars).toHaveBeenCalledTimes(2); // covers fail → refetch
        });

        // ── today=null (delisted) → history only, no crash ───────────────────
        it('today=null (delisted) → returns history only, no crash', async () => {
            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            expect(result).toHaveLength(1);
            expect(result[0]!.time).toBe(histBar.time);
            // bars:today key is NOT written (shouldCache: bars.length > 0 → false for [])
            expect(store.has('bars:today:AAPL')).toBe(false);
        });

        // ── merge: today bar appears last; today wins on same-time overlap ────
        it('merge: today bar (time > history newest) appears last', async () => {
            const histTime = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            const todayTime = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [bar(histTime)]);
            const getTodayBar = vi.fn(async () => bar(todayTime));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            expect(result.map(b => b.time)).toEqual([histTime, todayTime]);
        });

        it('merge: today wins on same-time overlap', async () => {
            const sharedTime = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const histBar: Bar = {
                time: sharedTime,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000,
            };
            const todayBarObj: Bar = {
                time: sharedTime,
                open: 200,
                high: 220,
                low: 180,
                close: 210,
                volume: 9999,
            };
            const getBars = vi.fn(async () => [histBar]);
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars(longOpts);
            expect(result).toHaveLength(1);
            // today (close=210) wins over history (close=105)
            expect(result[0]!.close).toBe(210);
        });

        // ── guard branches ────────────────────────────────────────────────────
        it('1Day with before set → single-key path (no eodhist/today keys)', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
                before: '2026-06-20',
            });
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(
                [...store.keys()].some(k => k.startsWith('bars:eodhist'))
            ).toBe(false);
            expect(
                [...store.keys()].some(k => k.startsWith('bars:today'))
            ).toBe(false);
            expect(store.has('bars:raw:AAPL:1Day:2024-01-01:2026-06-20:')).toBe(
                true
            );
        });

        it('short lookback (from within recent window) → single-key path', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2026-06-27', // within recentFrom(2026-06-20)
            });
            expect(
                [...store.keys()].some(k => k.startsWith('bars:eodhist'))
            ).toBe(false);
            expect([...store.keys()].some(k => k.startsWith('bars:raw'))).toBe(
                true
            );
        });

        it('non-1Day stays on single-key path', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
                from: '2026-06-20',
            });
            expect(getBars).toHaveBeenCalledTimes(1);
            expect([...store.keys()].some(k => k.startsWith('bars:eod'))).toBe(
                false
            );
        });

        // ── sliceFrom boundary ────────────────────────────────────────────────
        it('sliceFrom keeps a bar exactly at options.from (inclusive boundary)', async () => {
            const boundary = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [bar(boundary)]);
            const getTodayBar = vi.fn(async () => null);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-06-30',
            });
            expect(result.map(b => b.time)).toContain(boundary);
        });

        // ── from=undefined → anchored split taken, unsliced ───────────────────
        it('from=undefined → anchored split taken, merged result returned unsliced', async () => {
            const histT = Math.floor(Date.parse('2026-06-26T00:00:00Z') / 1000);
            const todayT = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => [bar(histT)]);
            const getTodayBar = vi.fn(async () => bar(todayT));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            }); // no from
            expect(store.has('bars:eodhist:AAPL')).toBe(true);
            expect(store.has('bars:today:AAPL')).toBe(true);
            expect(getBars).toHaveBeenCalledTimes(1);
            expect(result.map(b => b.time)).toEqual([histT, todayT]);
        });

        // ── throw on split path → no cache poisoning ──────────────────────────
        it('inner.getBars throw on split path → rejects without caching anything', async () => {
            const getBars = vi.fn(async () => {
                throw new Error('FMP 503');
            });
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars })
            );

            await expect(
                provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                    from: '2024-01-01',
                })
            ).rejects.toThrow('FMP 503');
            expect(store.size).toBe(0);
        });

        // ── Redis-down fallback on split path ─────────────────────────────────
        it('redisEnabled=false on split path → returns merged result, store empty', async () => {
            redisEnabled = false;
            const t1 = Math.floor(Date.parse('2024-06-01T00:00:00Z') / 1000);
            const t2 = Math.floor(Date.parse('2026-06-30T00:00:00Z') / 1000);
            const getBars = vi.fn(async () => [bar(t1)]);
            const getTodayBar = vi.fn(async () => bar(t2));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });
            expect(result.map(b => b.time)).toEqual([t1, t2]);
            expect(store.size).toBe(0);
        });

        // ── empty history shouldCache guard ───────────────────────────────────
        it('history returns [] → bars:eodhist NOT written; bars:today written if non-empty', async () => {
            const todayT = Math.floor(
                Date.parse('2026-06-30T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async () => []);
            const getTodayBar = vi.fn(async () => bar(todayT));
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });
            expect(store.has('bars:eodhist:AAPL')).toBe(false);
            expect(store.has('bars:today:AAPL')).toBe(true);
            expect(result.map(b => b.time)).toEqual([todayT]);
        });

        // ── bars:today TTL: session-aware ─────────────────────────────────────
        it('bars:today TTL: market-open instant → 60s', async () => {
            // ET regular session open: Mon 2026-06-29 14:30 UTC = 10:30 ET
            vi.setSystemTime(new Date('2026-06-29T14:30:00Z'));
            resetSharedState();

            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000)
            );
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            const todaySetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('bars:today')
            );
            expect(todaySetCall).toBeDefined();
            expect(todaySetCall![2]?.ex).toBe(60); // open-session TTL
        });

        it('bars:today TTL: market-closed instant → > 60s', async () => {
            // Saturday 2026-06-27 12:00 UTC — US equity market closed
            vi.setSystemTime(new Date('2026-06-27T12:00:00Z'));
            resetSharedState();

            const histBar = bar(
                Math.floor(Date.parse('2024-06-30T00:00:00Z') / 1000)
            );
            const getBars = vi.fn(async () => [histBar]);
            const todayBarObj = bar(
                Math.floor(Date.parse('2026-06-27T00:00:00Z') / 1000)
            );
            const getTodayBar = vi.fn(async () => todayBarObj);
            const provider = new CachedMarketDataProvider(
                makeInner({ getBars, getTodayBar })
            );

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            const todaySetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('bars:today')
            );
            expect(todaySetCall).toBeDefined();
            expect(todaySetCall![2]?.ex).toBeGreaterThan(60); // closed-session TTL > 60s
        });
    });

    describe('session spec — TTL', () => {
        // computeBarsEffectiveTtl(.., new Date(), ..)이 실제 벽시계를 쓰므로, ET 정규장 중에는
        // US_EQUITY의 open-TTL이 60이 되어 CRYPTO(항상 60)와 구분되지 않아 테스트가 시각에 따라
        // 깨졌다. 장이 닫힌 시각(토요일)으로 고정해 US_EQUITY가 closed-TTL(≠60)을 쓰도록 결정화한다.
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-01-03T12:00:00Z')); // 토요일 — 미국 장 마감
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('CRYPTO_SESSION → computeBarsEffectiveTtl이 always-open(60초) TTL을 반환한다', async () => {
            const inner = makeInner();
            const p = new CachedMarketDataProvider(inner, CRYPTO_SESSION);
            await p.getBars(barsOpts());
            /**
             * 60 = siglens-core 내부 open-TTL 상수(BARS_OPEN_TTL_SECONDS 또는 동등값).
             * @y0ngha/siglens-core@0.26.0 는 해당 상수를 외부로 export하지 않으므로
             * 리터럴로 고정한다. core의 open-TTL 값이 변경되면 이 값도 함께 갱신해야 한다(드리프트 위험).
             */
            expect(lastSetTtl.value).toBe(60);
        });

        it('기본 session(US_EQUITY_SESSION) → computeBarsEffectiveTtl이 ET 기반 TTL을 사용한다', async () => {
            const inner = makeInner();
            // US_EQUITY_SESSION 기본값 — ET 세션 기반 TTL(60 이외의 값)을 반환한다.
            const p = new CachedMarketDataProvider(inner);
            await p.getBars(barsOpts());
            // CRYPTO_SESSION의 60과 다름을 보장 — 정확한 값은 computeBarsEffectiveTtl 구현에 종속.
            expect(lastSetTtl.value).not.toBe(60);
            expect(typeof lastSetTtl.value).toBe('number');
        });
    });
});
