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
    marketSummaryConfigFingerprint: vi.fn(() => 'abcdef012345'),
}));

vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => ({})),
    // scope 인지 팩토리도 같은 모듈에 있다 — 목에서 빠지면 액션이 import 단계에서
    // 실패해 `server_error`로 조용히 떨어진다.
    marketDataProviderFor: vi.fn(() => ({})),
}));

import { getMarketSummaryStatic } from '../api/marketSummaryStaticCache';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';

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

        const result = await getMarketSummaryStatic(US_DASHBOARD_SCOPE);

        expect(result).toBe(sampleSummary);
        expect(mockGetCachedMarketSummary).toHaveBeenCalledTimes(1);
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market:summary:us]', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        await getMarketSummaryStatic(US_DASHBOARD_SCOPE);

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:summary:us'],
        });
    });

    it('(Happy) static cache key에 dashboard 설정 fingerprint를 포함한다', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        await getMarketSummaryStatic(US_DASHBOARD_SCOPE);

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheKeys
        ).toEqual([
            'market-summary-static',
            // scope id가 키에 들어가야 미국·한국이 같은 엔트리를 공유하지 않는다.
            'us',
            expect.stringMatching(/^[a-f0-9]{12}$/),
        ]);
    });

    /**
     * 두 시장이 캐시 키나 태그를 공유하면 `/market/kr`이 미국 지수를 그리고도
     * 아무 신호가 나지 않는다 — 렌더는 정상이고 숫자도 맞아 보인다.
     */
    it('(Happy) kr scope는 미국과 다른 캐시 키·태그를 쓴다', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        await getMarketSummaryStatic(KR_DASHBOARD_SCOPE);

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheKeys
        ).toEqual([
            'market-summary-static',
            'kr',
            expect.stringMatching(/^[a-f0-9]{12}$/),
        ]);
        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:summary:kr'],
        });
    });

    it('(Happy) scope에 맞는 provider와 scope를 아래층 캐시에 넘긴다', async () => {
        mockGetCachedMarketSummary.mockResolvedValue(sampleSummary);

        await getMarketSummaryStatic(KR_DASHBOARD_SCOPE);

        // provider 팩토리에 scope id가 그대로 흘러야 KRX가 yahoo로 간다.
        expect(vi.mocked(marketDataProviderFor)).toHaveBeenCalledWith('kr');
        expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
            expect.anything(),
            KR_DASHBOARD_SCOPE
        );
    });

    it('(Worst) getCachedMarketSummary가 throw하면 에러가 전파된다', async () => {
        mockGetCachedMarketSummary.mockRejectedValue(new Error('fetch failed'));

        await expect(
            getMarketSummaryStatic(US_DASHBOARD_SCOPE)
        ).rejects.toThrow('fetch failed');
    });
});
