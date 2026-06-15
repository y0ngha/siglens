import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketSummaryData } from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
    unstable_cache: (
        fn: () => Promise<MarketSummaryData>,
        keys: unknown,
        opts: unknown
    ) => {
        (globalThis as Record<string, unknown>).__lastUnstableCacheKeys = keys;
        (globalThis as Record<string, unknown>).__lastUnstableCacheOpts = opts;
        return fn;
    },
}));

vi.mock('../api/marketSummaryCache', () => ({
    getCachedMarketSummary: vi.fn(),
    MARKET_SUMMARY_CONFIG_FINGERPRINT: 'abcdef012345',
}));

vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => ({})),
}));

import { getMarketSummaryStatic } from '../api/marketSummaryStaticCache';
import { getCachedMarketSummary } from '../api/marketSummaryCache';

const mockGetCachedMarketSummary = vi.mocked(getCachedMarketSummary);

const sampleSummary: MarketSummaryData = {
    indices: [
        {
            symbol: 'SPY',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: 'S&P 500',
            price: 5000,
            changesPercentage: 0.5,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 200,
            changesPercentage: 1.2,
        },
    ],
};

describe('getMarketSummaryStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete (globalThis as Record<string, unknown>).__lastUnstableCacheKeys;
        delete (globalThis as Record<string, unknown>).__lastUnstableCacheOpts;
    });

    it('(Happy) getCachedMarketSummary를 호출하고 결과를 반환한다', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        const result = await getMarketSummaryStatic();

        expect(result).toBe(sampleSummary);
        expect(mockGetCachedMarketSummary).toHaveBeenCalledTimes(1);
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market:summary]', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        await getMarketSummaryStatic();

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:summary'],
        });
    });

    it('(Happy) static cache key에 dashboard 설정 fingerprint를 포함한다', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        await getMarketSummaryStatic();

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheKeys
        ).toEqual([
            'market-summary-static',
            expect.stringMatching(/^[a-f0-9]{12}$/),
        ]);
    });

    it('(Worst) getCachedMarketSummary가 throw하면 에러가 전파된다', async () => {
        mockGetCachedMarketSummary.mockRejectedValue(new Error('fetch failed'));

        await expect(getMarketSummaryStatic()).rejects.toThrow('fetch failed');
    });
});
