import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('server-only', () => ({}));

// `next/cache`의 `unstable_cache`를 vi.fn()으로 대체해 호출 인자를 직접 캡처한다.
// globalThis에 stash하는 방식은 `forks` pool이 워커를 재사용할 때 다른 테스트
// 파일로 값이 새어나갈 수 있어, vi.hoisted로 만든 mock에만 담는다.
const { mockUnstableCache } = vi.hoisted(() => ({
    mockUnstableCache: vi.fn(
        (
            fn: () => Promise<MarketFearGreedView>,
            _keys: unknown,
            _opts: unknown
        ) => fn
    ),
}));

vi.mock('next/cache', () => ({
    unstable_cache: mockUnstableCache,
}));

vi.mock('@/entities/market-fear-greed/api/marketFearGreedCache', () => ({
    getCachedMarketFearGreed: vi.fn(),
    MARKET_FEAR_GREED_CONFIG_FINGERPRINT: 'abcdef012345',
}));

import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import { getCachedMarketFearGreed } from '@/entities/market-fear-greed/api/marketFearGreedCache';

const mockGetCachedMarketFearGreed = vi.mocked(getCachedMarketFearGreed);

const sampleView: MarketFearGreedView = {
    snapshot: {
        score: 62,
        label: 'GREED',
        factors: [],
        confidence: 'normal',
        sampleSize: 200,
        asOf: '2026-08-14',
    },
    comparisons: [],
};

describe('getMarketFearGreedStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('(Happy) getCachedMarketFearGreed를 호출하고 결과를 반환한다', async () => {
        mockGetCachedMarketFearGreed.mockResolvedValue(sampleView);

        const result = await getMarketFearGreedStatic();

        expect(result).toBe(sampleView);
        expect(mockGetCachedMarketFearGreed).toHaveBeenCalledTimes(1);
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market:fear-greed]', async () => {
        mockGetCachedMarketFearGreed.mockResolvedValue(sampleView);

        await getMarketFearGreedStatic();

        const [, , opts] = mockUnstableCache.mock.calls[0]!;
        expect(opts).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:fear-greed'],
        });
    });

    it('(Happy) static cache key가 market-fear-greed-static과 fingerprint로 구성된다', async () => {
        mockGetCachedMarketFearGreed.mockResolvedValue(sampleView);

        await getMarketFearGreedStatic();

        const [, keys] = mockUnstableCache.mock.calls[0]!;
        expect(keys).toEqual(['market-fear-greed-static', 'abcdef012345']);
    });

    it('(Worst) getCachedMarketFearGreed가 throw하면 에러가 전파된다', async () => {
        mockGetCachedMarketFearGreed.mockRejectedValue(
            new Error('fetch failed')
        );

        await expect(getMarketFearGreedStatic()).rejects.toThrow(
            'fetch failed'
        );
    });
});
