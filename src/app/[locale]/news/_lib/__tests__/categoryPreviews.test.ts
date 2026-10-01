const mocks = vi.hoisted(() => ({
    cacheNonEmpty: vi.fn(),
    getMarketNewsCards: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/cacheNonEmpty', () => ({
    cacheNonEmpty: mocks.cacheNonEmpty,
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    getMarketNewsCards: mocks.getMarketNewsCards,
}));
vi.mock('@/widgets/news-hub/CategoryCard', () => ({
    PREVIEW_HEADLINE_LIMIT: 2,
}));
vi.mock('@/shared/lib/news/resolveNewsTitle', () => ({
    resolveNewsTitle: (row: { titleKo: string }) => row.titleKo,
}));

import { fetchCategoryPreviews } from '@/app/[locale]/news/_lib/categoryPreviews';
import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_CACHE_TAG_PREFIX } from '@/entities/market-news/lib/marketNewsConstants';
import { SECONDS_PER_DAY } from '@/shared/config/time';

describe('fetchCategoryPreviews', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * 빈 목록이 24h 굳으면 허브 카드가 하루 내내 "불러오고 있어요"로 남는다 —
     * 그래서 `cacheNonEmpty`(빈 결과 비캐시)를 쓰고 인자가 계약대로여야 한다.
     */
    it('cacheNonEmpty에 키·sentinel·태그·SECONDS_PER_DAY를 넘긴다', async () => {
        mocks.cacheNonEmpty.mockResolvedValue([]);
        const cfg = CATEGORY_CONFIG.forex;

        await fetchCategoryPreviews('forex', 'ko');

        const [keyParts, sentinel, fetcher, tags, revalidate] =
            mocks.cacheNonEmpty.mock.calls[0];
        expect(keyParts.slice(0, 2)).toEqual([
            'market-news:list',
            cfg.sentinel,
        ]);
        expect(sentinel).toBe(cfg.sentinel);
        expect(tags).toEqual([
            `${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`,
        ]);
        expect(revalidate).toBe(SECONDS_PER_DAY);

        mocks.getMarketNewsCards.mockResolvedValue([]);
        await fetcher();
        expect(mocks.getMarketNewsCards).toHaveBeenCalledWith(
            cfg.sentinel,
            'ko'
        );
    });

    it('빈 결과면 []를 돌려준다', async () => {
        mocks.cacheNonEmpty.mockResolvedValue([]);

        await expect(fetchCategoryPreviews('forex', 'ko')).resolves.toEqual([]);
    });

    it('상위 PREVIEW_HEADLINE_LIMIT개만 제목으로 변환한다', async () => {
        mocks.cacheNonEmpty.mockResolvedValue([
            { titleKo: 'a' },
            { titleKo: 'b' },
            { titleKo: 'c' },
        ]);

        await expect(fetchCategoryPreviews('forex', 'ko')).resolves.toEqual([
            'a',
            'b',
        ]);
    });
});
