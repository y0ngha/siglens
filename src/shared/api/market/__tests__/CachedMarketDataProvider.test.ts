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

const barsOpts = (o: Partial<GetBarsOptions> = {}): GetBarsOptions => ({
    symbol: 'aapl',
    timeframe: '1Day',
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

describe('CachedMarketDataProvider', () => {
    beforeEach(reset);

    it('getBars: miss→fetch→set, hit→캐시값(키 bars:raw:SYM:TF:from:before:limit)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);

        const first = await p.getBars(barsOpts());
        expect(first).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01::')).toBe(true);

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
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01::')).toBe(false);
    });

    it('getBars: from/before/limit이 모두 undefined면 키에 빈 문자열로 채워진다 (?? 가드)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: undefined }));
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:1Day:::')).toBe(true);
    });

    it('getBars: from/before가 다르면 키가 분리된다', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: '2026-01-01' }));
        await p.getBars(barsOpts({ from: '2026-02-01' }));
        await p.getBars(barsOpts({ from: '2026-01-01', before: '2026-03-01' }));
        expect(inner.getBars).toHaveBeenCalledTimes(3);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01::')).toBe(true);
        expect(store.has('bars:raw:AAPL:1Day:2026-02-01::')).toBe(true);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01:2026-03-01:')).toBe(
            true
        );
    });

    it('getBars: limit이 다르면 키가 분리된다 (옵션 확장 시 캐시 충돌 방지)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ limit: 100 }));
        await p.getBars(barsOpts({ limit: 200 }));
        expect(inner.getBars).toHaveBeenCalledTimes(2);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01::100')).toBe(true);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01::200')).toBe(true);
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
