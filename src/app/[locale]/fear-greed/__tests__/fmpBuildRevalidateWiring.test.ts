vi.mock('@/widgets/market-fear-greed/MarketFearGreedPage', () => ({
    MarketFearGreedPage: () => null,
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: vi.fn(async () => ({
        snapshot: null,
        comparisons: [],
    })),
}));
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache',
    () => ({
        getMarketFearGreedCryptoStatic: vi.fn(async () => ({
            snapshot: null,
            comparisons: [],
        })),
    })
);
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({
        getMarketFearGreedKrStatic: vi.fn(async () => ({
            snapshot: null,
            comparisons: [],
        })),
    })
);
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: vi.fn(async () => undefined),
    shortenRevalidateIfDatabaseMissingAtBuild: vi.fn(async () => undefined),
}));
vi.mock('@/entities/ticker/lib/loadSymbolNames', () => ({
    loadSymbolNames: vi.fn(async () => new Map<string, string>()),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import FearGreedRoutePage from '@/app/[locale]/fear-greed/page';
import FearGreedCryptoRoutePage from '@/app/[locale]/fear-greed/crypto/page';
import FearGreedKrRoutePage from '@/app/[locale]/fear-greed/kr/page';
import { loadFearGreedView } from '@/app/[locale]/fear-greed/fearGreedRoute';
import { shortenRevalidateIfFmpFailedAtBuild } from '@/shared/cache/buildDegradedRevalidate';

const mockShorten = vi.mocked(shortenRevalidateIfFmpFailedAtBuild);
const params = Promise.resolve({ locale: 'ko' });

/**
 * 빌드 중 FMP가 죽었을 때 60초 degrade revalidate는 FMP 라우트(us·crypto)에만 걸려야
 * 한다. 각 라우트의 FMP 여부(`scopeUsesFmp(market)`)를 실제 페이지 경유로 고정한다 — kr(yahoo)이 FMP로
 * 바뀌면 FMP 장애와 무관한 정상 페이지가 매 60초 재생성된다.
 */
describe('fear-greed 라우트의 빌드 degrade revalidate 배선', () => {
    beforeEach(() => {
        mockShorten.mockClear();
    });

    it.each([
        ['/fear-greed', FearGreedRoutePage],
        ['/fear-greed/crypto', FearGreedCryptoRoutePage],
    ] as const)('FMP 라우트 %s는 헬퍼를 부른다', async (_route, Page) => {
        await Page({ params });
        expect(mockShorten).toHaveBeenCalledOnce();
    });

    it('yahoo인 /fear-greed/kr는 헬퍼를 부르지 않는다', async () => {
        await FearGreedKrRoutePage({ params });
        expect(mockShorten).not.toHaveBeenCalled();
    });

    it.each([
        ['us', 1],
        ['crypto', 1],
        ['kr', 0],
    ] as const)(
        'loadFearGreedView는 market=%s의 시세 출처(scopeUsesFmp)를 따른다',
        async (market, calls) => {
            await loadFearGreedView({
                market,
                load: async () => ({ snapshot: null, comparisons: [] }),
                failureLog: '[test]',
            });
            expect(mockShorten).toHaveBeenCalledTimes(calls);
        }
    );
});
