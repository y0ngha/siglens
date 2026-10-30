vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: vi.fn() }));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet: vi.fn() }));
vi.mock('@/entities/ticker/server/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn(),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    buildExtendedQuoteKey,
    loadExtendedHoursQuote,
} from '@/entities/extended-hours/api';
import type { ExtendedHoursQuote } from '@/entities/extended-hours/model';
import { getRedisClient } from '@/shared/cache/redisClient';
import { __resetInFlightForTests } from '@/shared/cache/getOrSetCache';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { getAssetInfoStatic } from '@/entities/ticker/server/getAssetInfoStatic';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import {
    EXTENDED_QUOTE_CACHE_TTL_SECONDS,
    EXTENDED_QUOTE_TIMEOUT_CACHE_TTL_SECONDS,
} from '@/shared/config/time';
import { QUOTE_LOOKUP_TIMEOUT_MS } from '@/shared/api/market/quoteTimeout';
import type { AssetInfo } from '@/shared/lib/types';
import aftermarketTradeFixture from '@/shared/api/fmp/__tests__/fixtures/aftermarketTrade.aapl.json';
import quoteFixture from '@/shared/api/fmp/__tests__/fixtures/quote.aapl.preMarket.json';

const mockedRedis = vi.mocked(getRedisClient);
const mockedFmpGet = vi.mocked(fmpGet);
const mockedAssetInfo = vi.mocked(getAssetInfoStatic);
const mockedCachedProvider = vi.mocked(getCachedMarketDataProvider);

/** 라이브 프로브와 같은 순간 — 2026-10-15 07:07:16 ET, 프리마켓. */
const PRE_NOW = new Date('2026-10-15T11:07:16Z');
const REGULAR_NOW = new Date('2026-10-15T16:00:00Z');
const WEEKEND_NOW = new Date('2026-10-17T12:00:00Z');
const HOLIDAY_NOW = new Date('2026-11-26T11:00:00Z');

const AAPL: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc.' };

interface RedisStub {
    store: Map<string, unknown>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
}

function createRedisStub(): RedisStub {
    const store = new Map<string, unknown>();
    return {
        store,
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
            return 'OK';
        }),
    };
}

describe('loadExtendedHoursQuote', () => {
    let redis: RedisStub;
    let getQuote: ReturnType<typeof vi.fn>;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        __resetInFlightForTests();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // 거부형 기본값 — 모듈 목을 우회한 실제 네트워크 요청은 즉시 실패한다.
        fetchSpy = vi
            .fn()
            .mockRejectedValue(new Error('network must not be used'));
        vi.stubGlobal('fetch', fetchSpy);

        redis = createRedisStub();
        mockedRedis.mockReturnValue(redis as never);
        mockedAssetInfo.mockResolvedValue(AAPL);
        mockedFmpGet.mockImplementation(async path => {
            if (path === 'aftermarket-trade') return aftermarketTradeFixture;
            throw new Error(`unexpected FMP path: ${path}`);
        });
        getQuote = vi.fn().mockResolvedValue({
            symbol: 'AAPL',
            price: quoteFixture[0]!.price,
            changesPercentage: quoteFixture[0]!.changePercentage,
            name: 'Apple Inc.',
            timestamp: quoteFixture[0]!.timestamp,
        });
        mockedCachedProvider.mockReturnValue({ getQuote } as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    describe('확장 세션 밖에서는 FMP·Redis·자산 조회를 전혀 하지 않는다', () => {
        it.each([
            ['정규장', REGULAR_NOW],
            ['주말', WEEKEND_NOW],
            ['휴장일(추수감사절)', HOLIDAY_NOW],
            ['야간', new Date('2026-10-16T03:00:00Z')],
        ])('%s → null', async (_label, now) => {
            await expect(
                loadExtendedHoursQuote('AAPL', now)
            ).resolves.toBeNull();

            expect(mockedFmpGet).not.toHaveBeenCalled();
            expect(getQuote).not.toHaveBeenCalled();
            expect(mockedRedis).not.toHaveBeenCalled();
            expect(mockedAssetInfo).not.toHaveBeenCalled();
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('프리마켓 캐시 미스', () => {
        it('aftermarket-trade와 기준 종가로 시세를 만들고 quote:ext 키에 60초로 쓴다', async () => {
            const result = await loadExtendedHoursQuote('aapl', PRE_NOW);

            expect(result).toMatchObject({
                session: 'pre-market',
                price: 346.38,
                referenceClose: 342.96,
            });
            expect(mockedFmpGet).toHaveBeenCalledTimes(1);
            expect(mockedFmpGet).toHaveBeenCalledWith('aftermarket-trade', {
                symbol: 'AAPL',
            });
            expect(getQuote).toHaveBeenCalledWith('AAPL');
            expect(redis.set).toHaveBeenCalledTimes(1);
            expect(redis.set).toHaveBeenCalledWith(
                'quote:ext:AAPL',
                expect.anything(),
                { ex: EXTENDED_QUOTE_CACHE_TTL_SECONDS }
            );
            expect(EXTENDED_QUOTE_CACHE_TTL_SECONDS).toBe(60);
        });

        it('기존 시세·봉 캐시 키는 건드리지 않는다', async () => {
            await loadExtendedHoursQuote('AAPL', PRE_NOW);

            const writtenKeys = redis.set.mock.calls.map(([key]) => key);
            expect(writtenKeys).toEqual(['quote:ext:AAPL']);
            expect(buildExtendedQuoteKey('AAPL')).not.toMatch(
                /^(quote:snapshot:|bars:)/
            );
        });
    });

    describe('캐시 히트', () => {
        const cached: ExtendedHoursQuote = {
            session: 'pre-market',
            price: 999.5,
            referenceClose: 900,
            change: 99.5,
            changePercent: 11.05,
            tradedAtMs: PRE_NOW.getTime() - 5000,
        };

        it('FMP를 부르지 않고 캐시 값을 돌려준다', async () => {
            redis.store.set('quote:ext:AAPL', { data: cached });

            const result = await loadExtendedHoursQuote('AAPL', PRE_NOW);

            expect(result).toEqual(cached);
            expect(mockedFmpGet).not.toHaveBeenCalled();
            expect(getQuote).not.toHaveBeenCalled();
            expect(redis.set).not.toHaveBeenCalled();
        });

        it('캐시된 null(체결 없음)도 히트로 처리해 FMP를 다시 부르지 않는다', async () => {
            redis.store.set('quote:ext:AAPL', { data: null });

            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();
            expect(mockedFmpGet).not.toHaveBeenCalled();
        });

        it('다른 세션에서 쓰인 캐시 값은 쓰지 않고 새로 받는다', async () => {
            redis.store.set('quote:ext:AAPL', {
                data: { ...cached, session: 'after-hours' },
            });

            const result = await loadExtendedHoursQuote('AAPL', PRE_NOW);

            expect(result?.price).toBe(346.38);
            expect(mockedFmpGet).toHaveBeenCalledTimes(1);
        });
    });

    describe('열려 있지 않은 대상은 FMP 시세 조회까지 가지 않는다', () => {
        it.each([
            ['알 수 없는 종목', null],
            [
                '한국 주식',
                {
                    symbol: '005930.KS',
                    name: 'Samsung',
                    marketProfile: 'kr-equity',
                },
            ],
            [
                '크립토',
                { symbol: 'BTCUSD', name: 'Bitcoin', marketProfile: 'crypto' },
            ],
            ['지수', { symbol: 'SPX', name: 'S&P 500', fmpSymbol: '^SPX' }],
        ])('%s → null', async (_label, asset) => {
            mockedAssetInfo.mockResolvedValue(asset as AssetInfo | null);

            await expect(
                loadExtendedHoursQuote('XYZ', PRE_NOW)
            ).resolves.toBeNull();
            expect(mockedFmpGet).not.toHaveBeenCalled();
            expect(getQuote).not.toHaveBeenCalled();
        });

        it.each([
            ['문자열이 아닌 입력', 42],
            ['객체', { symbol: 'AAPL' }],
            ['빈 문자열', ''],
            ['너무 긴 심볼', 'A'.repeat(17)],
            ['경로 문자 포함', '../AAPL'],
            ['공백 포함', 'AA PL'],
        ])('%s → 자산 조회 전에 null', async (_label, symbol) => {
            await expect(
                loadExtendedHoursQuote(symbol, PRE_NOW)
            ).resolves.toBeNull();
            expect(mockedAssetInfo).not.toHaveBeenCalled();
            expect(mockedFmpGet).not.toHaveBeenCalled();
        });

        it('E2E에서는 세션 안이어도 null이고 아무 곳도 건드리지 않는다', async () => {
            vi.stubEnv('E2E_TEST', '1');

            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();
            expect(mockedFmpGet).not.toHaveBeenCalled();
            expect(mockedRedis).not.toHaveBeenCalled();
            expect(mockedAssetInfo).not.toHaveBeenCalled();
        });
    });

    describe('체결 조회가 끝나지 않아도 정해진 시간 안에 null로 돌아온다', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it('fmpGet이 영영 resolve되지 않으면 상한(QUOTE_LOOKUP_TIMEOUT_MS)에 null이다', async () => {
            vi.useFakeTimers();
            mockedFmpGet.mockImplementation(() => new Promise(() => {}));

            let settled = false;
            const pending = loadExtendedHoursQuote('AAPL', PRE_NOW).then(r => {
                settled = true;
                return r;
            });

            await vi.advanceTimersByTimeAsync(QUOTE_LOOKUP_TIMEOUT_MS - 1);
            expect(settled).toBe(false);
            await vi.advanceTimersByTimeAsync(1);

            await expect(pending).resolves.toBeNull();
            expect(settled).toBe(true);
            expect(getQuote).not.toHaveBeenCalled();
        });

        it('시간 초과 null은 짧은 TTL로만 굳힌다 — 회복한 FMP를 60초 가리지 않는다', async () => {
            vi.useFakeTimers();
            mockedFmpGet.mockImplementation(() => new Promise(() => {}));

            const pending = loadExtendedHoursQuote('AAPL', PRE_NOW);
            await vi.advanceTimersByTimeAsync(QUOTE_LOOKUP_TIMEOUT_MS);
            await pending;

            expect(redis.set).toHaveBeenCalledTimes(1);
            expect(redis.set).toHaveBeenCalledWith(
                'quote:ext:AAPL',
                expect.anything(),
                { ex: EXTENDED_QUOTE_TIMEOUT_CACHE_TTL_SECONDS }
            );
            expect(EXTENDED_QUOTE_TIMEOUT_CACHE_TTL_SECONDS).toBeLessThan(
                EXTENDED_QUOTE_CACHE_TTL_SECONDS
            );
        });

        it('상한 안에 끝나는 느린 응답은 정상 값이고 60초 TTL이다', async () => {
            vi.useFakeTimers();
            mockedFmpGet.mockImplementation(
                () =>
                    new Promise(resolve =>
                        setTimeout(
                            () => resolve(aftermarketTradeFixture),
                            QUOTE_LOOKUP_TIMEOUT_MS - 1000
                        )
                    )
            );

            const pending = loadExtendedHoursQuote('AAPL', PRE_NOW);
            await vi.advanceTimersByTimeAsync(QUOTE_LOOKUP_TIMEOUT_MS);

            await expect(pending).resolves.toMatchObject({ price: 346.38 });
            expect(redis.set).toHaveBeenCalledWith(
                'quote:ext:AAPL',
                expect.anything(),
                { ex: EXTENDED_QUOTE_CACHE_TTL_SECONDS }
            );
        });
    });

    describe('FMP가 비었거나 실패해도 던지지 않고 null이다', () => {
        it('체결이 빈 배열이면 null이고 기준 시세는 받지 않으며 null을 60초 굳힌다', async () => {
            mockedFmpGet.mockResolvedValue([]);

            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();
            expect(getQuote).not.toHaveBeenCalled();
            expect(redis.set).toHaveBeenCalledWith(
                'quote:ext:AAPL',
                expect.anything(),
                { ex: EXTENDED_QUOTE_CACHE_TTL_SECONDS }
            );
        });

        it('키 없음/402/429처럼 조회가 던지면 null이고, 같은 윈도에서 다시 두드리지 않는다', async () => {
            mockedFmpGet.mockRejectedValue(new Error('FMP config missing'));

            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();
            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();

            expect(mockedFmpGet).toHaveBeenCalledTimes(1);
        });

        it('기준 시세 조회가 던져도 null이다', async () => {
            getQuote.mockRejectedValue(new Error('quote down'));

            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();
        });

        it('기준 시세가 없으면(null) 등락을 못 만들어 null이다', async () => {
            getQuote.mockResolvedValue(null);

            await expect(
                loadExtendedHoursQuote('AAPL', PRE_NOW)
            ).resolves.toBeNull();
        });

        it('실제 네트워크(fetch)는 어떤 경로에서도 쓰이지 않는다', async () => {
            await loadExtendedHoursQuote('AAPL', PRE_NOW);

            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });
});
