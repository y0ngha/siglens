import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockFetch, mockTtl, mockRedisGet, mockRedisSet } = vi.hoisted(() => ({
    mockFetch: vi.fn(),
    mockTtl: vi.fn(() => 60),
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    fetchBarsWithIndicators: mockFetch,
    computeBarsEffectiveTtl: mockTtl,
}));

// 파생 값은 더 이상 Redis에 쓰지 않는다 — 클라이언트가 불리면 그 자체가 회귀다.
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => ({ get: mockRedisGet, set: mockRedisSet }),
}));

import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type BarsData,
    type MarketDataProvider,
} from '@y0ngha/siglens-core';
import {
    BARS_MEMORY_MAX_ENTRIES,
    __resetBarsMemoryForTests,
    getCachedBarsWithIndicators,
} from '../lib/barsDataCache';

const mockProvider = {} as MarketDataProvider;

const sampleBars: BarsData = {
    bars: [{ time: 1, open: 1, high: 2, low: 0, close: 1, volume: 10 }],
    indicators: {} as BarsData['indicators'],
};

const T0 = new Date('2026-10-06T15:00:00Z');

describe('getCachedBarsWithIndicators', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
        vi.clearAllMocks();
        mockTtl.mockReturnValue(60);
        __resetBarsMemoryForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('첫 호출은 core로 계산하고 Redis에는 읽지도 쓰지도 않는다', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        const r = await getCachedBarsWithIndicators(
            mockProvider,
            'AAPL',
            '1Day'
        );
        expect(mockFetch).toHaveBeenCalledWith(
            mockProvider,
            'AAPL',
            '1Day',
            undefined
        );
        expect(r).toBe(sampleBars);
        expect(mockRedisGet).not.toHaveBeenCalled();
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('TTL 안의 재호출은 메모리에서 같은 값을 낸다', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        await getCachedBarsWithIndicators(mockProvider, 'aapl', '1Day');
        const second = await getCachedBarsWithIndicators(
            mockProvider,
            'AAPL',
            '1Day'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(second).toBe(sampleBars);
    });

    it('computeBarsEffectiveTtl(세션 반영)이 지나면 다시 계산한다', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        await getCachedBarsWithIndicators(
            mockProvider,
            'BTCUSD',
            '1Day',
            undefined,
            CRYPTO_SESSION
        );
        expect(mockTtl).toHaveBeenCalledWith('1Day', T0, CRYPTO_SESSION);

        vi.setSystemTime(T0.getTime() + 59_000);
        await getCachedBarsWithIndicators(
            mockProvider,
            'BTCUSD',
            '1Day',
            undefined,
            CRYPTO_SESSION
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);

        vi.setSystemTime(T0.getTime() + 60_000);
        await getCachedBarsWithIndicators(
            mockProvider,
            'BTCUSD',
            '1Day',
            undefined,
            CRYPTO_SESSION
        );
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('세션을 생략하면 US_EQUITY_SESSION으로 TTL을 잰다', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        await getCachedBarsWithIndicators(mockProvider, 'AAPL', '5Min');
        expect(mockTtl).toHaveBeenCalledWith('5Min', T0, US_EQUITY_SESSION);
    });

    it('fmpSymbol·timeframe이 다르면 다른 항목이다', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        await getCachedBarsWithIndicators(mockProvider, 'SPX', '1Day', '^SPX');
        await getCachedBarsWithIndicators(mockProvider, 'SPX', '1Day');
        await getCachedBarsWithIndicators(mockProvider, 'SPX', '1Hour', '^SPX');
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            mockProvider,
            'SPX',
            '1Day',
            '^SPX'
        );
    });

    it('빈 봉은 캐시하지 않는다 — 다음 호출이 다시 계산한다', async () => {
        mockFetch.mockResolvedValue({ ...sampleBars, bars: [] });
        await getCachedBarsWithIndicators(mockProvider, 'AAPL', '1Day');
        await getCachedBarsWithIndicators(mockProvider, 'AAPL', '1Day');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('에러는 전파하고 캐시하지 않는다', async () => {
        mockFetch.mockRejectedValueOnce(new Error('fmp down'));
        await expect(
            getCachedBarsWithIndicators(mockProvider, 'AAPL', '1Day')
        ).rejects.toThrow('fmp down');
        mockFetch.mockResolvedValue(sampleBars);
        await expect(
            getCachedBarsWithIndicators(mockProvider, 'AAPL', '1Day')
        ).resolves.toBe(sampleBars);
    });

    it('같은 키의 동시 miss는 계산 한 번으로 접힌다', async () => {
        let resolve: (v: BarsData) => void = () => {};
        mockFetch.mockReturnValue(
            new Promise<BarsData>(r => {
                resolve = r;
            })
        );
        const a = getCachedBarsWithIndicators(mockProvider, 'NVDA', '1Day');
        const b = getCachedBarsWithIndicators(mockProvider, 'NVDA', '1Day');
        resolve(sampleBars);
        await expect(Promise.all([a, b])).resolves.toEqual([
            sampleBars,
            sampleBars,
        ]);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('상한을 넘으면 가장 오래 안 쓴 항목부터 버린다', async () => {
        mockFetch.mockResolvedValue(sampleBars);
        for (let i = 0; i <= BARS_MEMORY_MAX_ENTRIES; i++) {
            await getCachedBarsWithIndicators(mockProvider, `S${i}`, '1Day');
        }
        expect(mockFetch).toHaveBeenCalledTimes(BARS_MEMORY_MAX_ENTRIES + 1);
        // S0이 밀려났다.
        await getCachedBarsWithIndicators(mockProvider, 'S0', '1Day');
        expect(mockFetch).toHaveBeenCalledTimes(BARS_MEMORY_MAX_ENTRIES + 2);
        // 가장 최근 항목은 남아 있다.
        await getCachedBarsWithIndicators(
            mockProvider,
            `S${BARS_MEMORY_MAX_ENTRIES}`,
            '1Day'
        );
        expect(mockFetch).toHaveBeenCalledTimes(BARS_MEMORY_MAX_ENTRIES + 2);
    });
});
