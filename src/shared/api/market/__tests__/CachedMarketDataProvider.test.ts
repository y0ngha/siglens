import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedMarketDataProvider } from '@/shared/api/market/CachedMarketDataProvider';
import {
    CRYPTO_SESSION,
    type Bar,
    type GetBarsOptions,
    type MarketDataProvider,
    type MarketQuote,
} from '@y0ngha/siglens-core';

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
    overrides: Partial<MarketDataProvider> = {}
): MarketDataProvider {
    return {
        getBars: vi.fn(async () => SAMPLE_BARS),
        getQuote: vi.fn(async () => SAMPLE_QUOTE),
        ...overrides,
    } as MarketDataProvider;
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

    describe('1Day anchored 2-tier', () => {
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

        it('uses date-free anchored keys (bars:eodhist:<SYM>, bars:eodrecent:<SYM>)', async () => {
            // oldest bar(bar(1)) time=1 이 options.from('2024-06-30') 보다 훨씬 이전이므로
            // covers 체크를 통과하도록 utcMidnight('2024-06-30') 이하 값을 써야 한다.
            // bar(1)은 unix time 1 = 1970-01-01이므로 covers OK.
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined ? [bar(1)] : [bar(2)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
            await provider.getBars(longOpts);
            expect(store.has('bars:eodhist:AAPL')).toBe(true);
            expect(store.has('bars:eodrecent:AAPL')).toBe(true);
            // 날짜 세그먼트가 키에 없어야 함
            expect(
                [...store.keys()].some(k => /bars:eodhist:AAPL:\d/.test(k))
            ).toBe(false);
        });

        it('history is NOT refetched across a day boundary when still fresh (anchored key, overlap holds)', async () => {
            // history fetch(before=histTo)는 recentFrom 이후를 커버하는 봉을 반환하도록 구성.
            // oldest bar(covering)를 from('2024-06-30') 이하로 설정해 covers 체크 통과.
            const oldestBar = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // == options.from → covers
            const histBarTime = Math.floor(
                Date.parse('2026-06-25T00:00:00Z') / 1000
            ); // recentFrom(2026-06-20) 이후 → fresh
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(oldestBar), time: oldestBar },
                          { ...bar(histBarTime), time: histBarTime },
                      ]
                    : [bar(9)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await provider.getBars(longOpts); // day 1: history fetched once
            const histCallsDay1 = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;

            vi.setSystemTime(new Date('2026-07-01T15:00:00Z')); // 하루 경과
            await provider.getBars({ ...longOpts, from: '2024-07-01' });
            const histCallsTotal = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;

            expect(histCallsDay1).toBe(1);
            expect(histCallsTotal).toBe(1); // 자정 넘겨도 재fetch 없음(fresh)
        });

        it('history IS refetched when stale AND cooldown has expired (stale + cooldown expired → refetch)', async () => {
            // history fetch가 recentFrom 이전(오래된) 봉만 반환 → isFresh overlap=false
            // 첫 fetch 후 시간이 > EOD_HIST_STALE_RECHECK_SECONDS(1h) 경과 → 쿨다운 만료 → 재fetch
            const oldestBar = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // covers from='2024-06-30'
            const staleTime = Math.floor(
                Date.parse('2026-06-01T00:00:00Z') / 1000
            ); // recentFrom(2026-06-20) 이전 → overlap 소실
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(oldestBar), time: oldestBar },
                          { ...bar(staleTime), time: staleTime },
                      ]
                    : [bar(9)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await provider.getBars(longOpts); // 1차: stale, fetchedAt 기록

            // 2시간 경과 → nowSeconds - fetchedAt >= EOD_HIST_STALE_RECHECK_SECONDS(3600) → 재fetch
            vi.setSystemTime(new Date('2026-06-30T17:00:00Z'));
            await provider.getBars(longOpts);
            const histCalls = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;
            expect(histCalls).toBe(2); // 쿨다운 만료 → 재fetch
        });

        it('[Blocker fix] stale + within cooldown → served from cache (no refetch)', async () => {
            // permanent-stale(상장폐지/장기정지): newest bar never reaches recentFrom.
            // 2nd call within the same hour → cooldown active → 재fetch 없이 캐시 반환.
            const oldestBar = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // covers from='2024-06-30'
            const staleTime = Math.floor(
                Date.parse('2026-06-01T00:00:00Z') / 1000
            ); // recentFrom(2026-06-20) 이전 → overlap 소실
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(oldestBar), time: oldestBar },
                          { ...bar(staleTime), time: staleTime },
                      ]
                    : [bar(9)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await provider.getBars(longOpts); // 1차 fetch → stale, fetchedAt 기록

            // 30분 경과 → nowSeconds - fetchedAt = 1800 < 3600 → 쿨다운 내 → 재fetch 없음
            vi.setSystemTime(new Date('2026-06-30T15:30:00Z'));
            await provider.getBars(longOpts);
            const histCalls = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;
            expect(histCalls).toBe(1); // 쿨다운 내 → 캐시 서빙, 추가 fetch 없음
        });

        it('[truncation fix] shorter cache does not truncate a longer request', async () => {
            // 1차: oldest=2025-06-30(~1yr) 으로 캐시 워밍.
            // 2차: from='2024-06-30'(~2yr) 요청 → oldest(2025) > from(2024) → covers=false → 재fetch.
            const shortOldest = Math.floor(
                Date.parse('2025-06-30T00:00:00Z') / 1000
            ); // 캐시의 최古 봉
            const freshNewest = Math.floor(
                Date.parse('2026-06-25T00:00:00Z') / 1000
            ); // overlap 유지 → isFresh true(covers가 false면 무관)
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(shortOldest), time: shortOldest },
                          { ...bar(freshNewest), time: freshNewest },
                      ]
                    : [bar(9)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            // 1차: from='2025-06-30' → oldest(2025) <= from(2025) → covers OK → 캐시
            await provider.getBars({ ...longOpts, from: '2025-06-30' });
            const histCallsAfterFirst = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;
            expect(histCallsAfterFirst).toBe(1);

            // 2차: from='2024-06-30' → oldest(2025) > from(2024) → covers FAIL → 재fetch
            await provider.getBars({ ...longOpts, from: '2024-06-30' });
            const histCallsAfterSecond = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;
            expect(histCallsAfterSecond).toBe(2); // covers 실패 → 재fetch 발생
        });

        it('[boundary] isFresh recentFrom boundary: newest exactly == recentFromThreshold → fresh', async () => {
            // System time: 2026-06-30T15:00:00Z → recentFrom = 2026-06-20 → threshold = utcMidnight(2026-06-20)
            const recentFromThreshold = Math.floor(
                Date.parse('2026-06-20T00:00:00Z') / 1000
            );
            const oldestBar = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // covers from='2024-06-30'
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(oldestBar), time: oldestBar },
                          {
                              ...bar(recentFromThreshold),
                              time: recentFromThreshold,
                          },
                      ]
                    : [bar(9)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await provider.getBars(longOpts); // 1차
            await provider.getBars(longOpts); // 2차: 같은 시각 → fresh → 재fetch 없음
            const histCalls = getBars.mock.calls.filter(
                c => c[0].before !== undefined
            ).length;
            expect(histCalls).toBe(1); // >= inclusive → fresh, 재fetch 0
        });

        it('merges history + recent and slices to options.from', async () => {
            const oldestBar = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // == options.from → covers check 통과
            const inRange = Math.floor(
                Date.parse('2025-01-01T00:00:00Z') / 1000
            );
            const tooOld = Math.floor(
                Date.parse('2020-01-01T00:00:00Z') / 1000
            ); // from(2024-06-30) 이전 → 슬라이스로 제거
            const recentT = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(tooOld), time: tooOld },
                          { ...bar(oldestBar), time: oldestBar },
                          { ...bar(inRange), time: inRange },
                      ]
                    : [{ ...bar(recentT), time: recentT }]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
            const result = await provider.getBars(longOpts);
            const times = result.map(b => b.time);
            expect(times).toContain(inRange);
            expect(times).toContain(recentT);
            expect(times).not.toContain(tooOld); // options.from 이전은 슬라이스
            expect(times).toEqual([...times].sort((a, b) => a - b)); // 오름차순
        });

        it('cold symbol = 2 fetches (history + recent); repeat within session = 0', async () => {
            const oldestBar = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // covers from='2024-06-30'
            const freshHist = Math.floor(
                Date.parse('2026-06-25T00:00:00Z') / 1000
            ); // >= recentFrom → fresh
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [
                          { ...bar(oldestBar), time: oldestBar },
                          { ...bar(freshHist), time: freshHist },
                      ]
                    : [bar(9)]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
            await provider.getBars(longOpts);
            expect(getBars).toHaveBeenCalledTimes(2);
            await provider.getBars(longOpts); // 재접근
            expect(getBars).toHaveBeenCalledTimes(2); // 둘 다 캐시 hit → 추가 0
        });

        it('1Day with before set → single-key path (no anchored split)', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
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
            expect(store.has('bars:raw:AAPL:1Day:2024-01-01:2026-06-20:')).toBe(
                true
            );
        });

        it('short lookback (from within recent window) → single-key path', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2026-06-27',
            }); // recentFrom(2026-06-20) 이후
            expect(
                [...store.keys()].some(k => k.startsWith('bars:eodhist'))
            ).toBe(false);
            expect([...store.keys()].some(k => k.startsWith('bars:raw'))).toBe(
                true
            );
        });

        it('non-1Day stays on single-key path', async () => {
            const getBars = vi.fn(async () => [bar(1)]);
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
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

        // Preserved: FMP throw poison-prevention on split path
        it('(b) inner.getBars throw on split path → rejects without caching anything', async () => {
            const getBars = vi.fn(async (_o: GetBarsOptions) => {
                throw new Error('FMP 503');
            });
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await expect(
                provider.getBars({
                    symbol: 'AAPL',
                    timeframe: '1Day',
                    from: '2024-01-01',
                })
            ).rejects.toThrow('FMP 503');
            expect(store.size).toBe(0);
        });

        // Preserved: Redis-down fallback on split path
        it('(c) redisEnabled=false on split path → returns merged result, store empty', async () => {
            redisEnabled = false;
            // Use realistic unix timestamps (2024+) that survive sliceFrom('2024-01-01')
            const t1 = Math.floor(Date.parse('2024-06-01T00:00:00Z') / 1000);
            const t2 = Math.floor(Date.parse('2026-06-29T00:00:00Z') / 1000);
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [{ ...bar(t1), time: t1 }]
                    : [
                          { ...bar(t1), time: t1 },
                          { ...bar(t2), time: t2 },
                      ]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            expect(result.map(b => b.time)).toEqual([t1, t2]);
            expect(store.size).toBe(0);
        });

        // Preserved: empty-window shouldCache guard
        it('(e) one window returns [] → that window key NOT written; merge returns non-empty side', async () => {
            // Use realistic unix timestamp that survives sliceFrom('2024-01-01')
            const recentT = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            // historical returns [], recent returns [bar(recentT)]
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? []
                    : [{ ...bar(recentT), time: recentT }]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            // Historical key (empty result) must NOT be cached
            const hasHistKey = [...store.keys()].some(k =>
                k.startsWith('bars:eodhist')
            );
            expect(hasHistKey).toBe(false);
            // Recent key (non-empty) must be cached
            const hasRecentKey = [...store.keys()].some(k =>
                k.startsWith('bars:eodrecent')
            );
            expect(hasRecentKey).toBe(true);
            // Merge still returns the non-empty side
            expect(result.map(b => b.time)).toEqual([recentT]);
        });

        it('from=undefined → anchored split taken, merged result returned unsliced', async () => {
            const freshHist = Math.floor(
                Date.parse('2026-06-26T00:00:00Z') / 1000
            ); // >= recentFrom(2026-06-20) → fresh
            const recentT = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [{ ...bar(freshHist), time: freshHist }]
                    : [{ ...bar(recentT), time: recentT }]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            }); // no `from`
            expect(store.has('bars:eodhist:AAPL')).toBe(true);
            expect(store.has('bars:eodrecent:AAPL')).toBe(true);
            expect(getBars).toHaveBeenCalledTimes(2);
            // from 없음 → sliceFrom가 미절단(unsliced): 양쪽 봉 모두 유지
            expect(result.map(b => b.time)).toEqual([freshHist, recentT]);
        });

        it('sliceFrom keeps a bar exactly at options.from (inclusive boundary)', async () => {
            const boundary = Math.floor(
                Date.parse('2024-06-30T00:00:00Z') / 1000
            ); // == options.from — oldest bar이므로 covers(from) 통과
            const recentT = Math.floor(
                Date.parse('2026-06-29T00:00:00Z') / 1000
            );
            const getBars = vi.fn(async (o: GetBarsOptions) =>
                o.before !== undefined
                    ? [{ ...bar(boundary), time: boundary }]
                    : [{ ...bar(recentT), time: recentT }]
            );
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });
            const result = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-06-30',
            });
            expect(result.map(b => b.time)).toContain(boundary);
        });

        // Preserved: recent-window TTL — open vs closed
        it('(f) bars:eodrecent TTL: market-open instant → 60s', async () => {
            // ET regular session open: Mon 2026-06-29 14:30 UTC = 10:30 ET
            vi.setSystemTime(new Date('2026-06-29T14:30:00Z'));
            resetSharedState();

            const getBars = vi.fn(async (_o: GetBarsOptions) => [bar(1)]);
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            // Find the set call for bars:eodrecent:* key
            const recentSetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('bars:eodrecent')
            );
            expect(recentSetCall).toBeDefined();
            const recentTtl = recentSetCall?.[2]?.ex;
            expect(recentTtl).toBe(60); // open-session TTL
        });

        it('(f) bars:eodrecent TTL: market-closed instant → > 60s', async () => {
            // Saturday 2026-06-27 12:00 UTC — US equity market closed
            vi.setSystemTime(new Date('2026-06-27T12:00:00Z'));
            resetSharedState();

            const getBars = vi.fn(async (_o: GetBarsOptions) => [bar(1)]);
            const provider = new CachedMarketDataProvider({
                getBars,
                getQuote: vi.fn(async () => null),
            });

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                from: '2024-01-01',
            });

            // Find the set call for bars:eodrecent:* key
            const recentSetCall = fakeRedis.set.mock.calls.find(
                ([key]) =>
                    typeof key === 'string' && key.startsWith('bars:eodrecent')
            );
            expect(recentSetCall).toBeDefined();
            const recentTtl = recentSetCall?.[2]?.ex;
            expect(typeof recentTtl).toBe('number');
            expect(recentTtl).toBeGreaterThan(60); // closed-session TTL > 60s
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
