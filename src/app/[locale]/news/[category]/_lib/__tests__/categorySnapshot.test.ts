vi.mock('@/shared/cache/cacheNonEmpty', () => ({
    cacheNonEmptyOrNull: vi.fn(),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: vi.fn(async () => undefined),
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    getMarketNewsCards: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCategorySnapshot } from '@/app/[locale]/news/[category]/_lib/categorySnapshot';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { cacheNonEmptyOrNull } from '@/shared/cache/cacheNonEmpty';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';

const ITEM: MarketNewsCardItem = {
    id: 'n1',
    source: 'Reuters',
    url: 'https://example.com/a1',
    publishedAt: '2026-06-22T10:00:00.000Z',
    titleEn: 'Headline',
    titleKo: '헤드라인',
    bodyKo: null,
    summaryKo: null,
    sentiment: null,
    category: null,
    priceImpact: null,
    tickers: [],
};

// `React.cache`가 같은 인자를 요청 안에서 기억하므로 테스트마다 다른 (카테고리, 로케일)을 쓴다.
describe('loadCategorySnapshot', () => {
    beforeEach(() => {
        vi.mocked(shortenRevalidateForRuntimeDegrade).mockClear();
    });

    it('읽기 실패(null)면 빈 스냅샷으로 흡수하고 이 렌더의 revalidate를 낮춘다', async () => {
        vi.mocked(cacheNonEmptyOrNull).mockResolvedValueOnce(null);

        await expect(loadCategorySnapshot('stock', 'ko')).resolves.toEqual({
            items: [],
            isEmpty: true,
        });
        expect(shortenRevalidateForRuntimeDegrade).toHaveBeenCalledTimes(1);
    });

    it('건강한 빈 목록([])은 비었다고 보되 revalidate는 그대로 둔다', async () => {
        vi.mocked(cacheNonEmptyOrNull).mockResolvedValueOnce([]);

        await expect(loadCategorySnapshot('forex', 'ko')).resolves.toEqual({
            items: [],
            isEmpty: true,
        });
        expect(shortenRevalidateForRuntimeDegrade).not.toHaveBeenCalled();
    });

    it('기사가 있으면 그대로 싣고 비지 않았다고 본다', async () => {
        vi.mocked(cacheNonEmptyOrNull).mockResolvedValueOnce([ITEM]);

        await expect(loadCategorySnapshot('crypto', 'en')).resolves.toEqual({
            items: [ITEM],
            isEmpty: false,
        });
        expect(shortenRevalidateForRuntimeDegrade).not.toHaveBeenCalled();
    });

    it('목록 캐시 키·태그를 카테고리 sentinel로 잡는다', async () => {
        vi.mocked(cacheNonEmptyOrNull).mockResolvedValueOnce([ITEM]);

        await loadCategorySnapshot('general', 'ko');

        expect(cacheNonEmptyOrNull).toHaveBeenLastCalledWith(
            expect.arrayContaining(['market-news:list', '__NEWS_GENERAL__']),
            '__NEWS_GENERAL__',
            expect.any(Function),
            ['market-news:__NEWS_GENERAL__'],
            SECONDS_PER_HALF_DAY
        );
    });
});
