import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { CATEGORY_CONFIG } from './categoryConfig';
import type {
    MarketNewsClientPort,
    MarketNewsItem,
} from './marketNewsClientPort';

/**
 * E2E-only market-news client returning deterministic fixture articles instead
 * of calling FMP. Reached only when `E2E_TEST=1` (see `getMarketNewsClient`).
 * Reads NO env keys and performs NO network I/O.
 *
 * Returns 2 items per category with the category's sentinel symbol and sample
 * tickers so the news category pages render without crashing.
 * Timestamps are anchored near the frozen E2E clock (2026-05-30) so they
 * survive any lookback-window filtering.
 */

const CATEGORY_TICKERS: Partial<Record<NewsFeedCategory, string[]>> = {
    crypto: ['BTCUSD'],
    stock: ['AAPL'],
};

function makeFakeItems(category: NewsFeedCategory): MarketNewsItem[] {
    const { sentinel } = CATEGORY_CONFIG[category];
    const tickers = CATEGORY_TICKERS[category] ?? [];
    return [
        {
            id: `e2e-market-news-${category}-1`,
            symbol: sentinel,
            source: 'E2E Wire',
            url: `http://localhost:4300/e2e/market-news/${category}/1`,
            publishedAt: '2026-05-29T14:00:00.000Z',
            titleEn: `E2E fixture ${category} headline one`,
            bodyEn: `Deterministic fixture body for the first E2E ${category} market-news article.`,
            tickers,
        },
        {
            id: `e2e-market-news-${category}-2`,
            symbol: sentinel,
            source: 'E2E Wire',
            url: `http://localhost:4300/e2e/market-news/${category}/2`,
            publishedAt: '2026-05-28T09:30:00.000Z',
            titleEn: `E2E fixture ${category} headline two`,
            bodyEn: `Deterministic fixture body for the second E2E ${category} market-news article.`,
            tickers,
        },
    ];
}

export class FakeMarketNewsClient implements MarketNewsClientPort {
    async fetchCategoryNews(
        category: NewsFeedCategory,
        _lookbackMs: number
    ): Promise<MarketNewsItem[]> {
        return makeFakeItems(category);
    }
}
