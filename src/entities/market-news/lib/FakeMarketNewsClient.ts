import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
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
 *
 * Timestamps are anchored RELATIVE to `Date.now()` (1·2일 전)이라, 서버의
 * `MARKET_NEWS_LOOKBACK_DAYS`(7일) lookback 윈도우 안에 항상 들어온다. 과거 고정
 * 날짜(2026-05-29)는 실시간이 지나며 lookback 밖으로 밀려 `getMarketNewsList`가 빈
 * 결과를 반환 → 카드 미렌더로 E2E가 시간이 지나며 깨졌다(time-rot). 상대 시각으로
 * 고정해 날짜와 무관하게 결정적으로 통과한다(타이틀은 불변).
 */

const CATEGORY_TICKERS: Partial<Record<NewsFeedCategory, string[]>> = {
    crypto: ['BTCUSD'],
    stock: ['AAPL'],
};

/**
 * Deterministic E2E fixture articles for a category. Exported so the E2E DB seed
 * (`e2e/setup/seed.ts`) can pre-populate `market_news` with the same data the
 * client-triggered ingestion would produce — making the category pages render
 * cards in SSR on the very first visit (no cold-start ingestion race).
 */
export function makeFakeItems(category: NewsFeedCategory): MarketNewsItem[] {
    const { sentinel } = CATEGORY_CONFIG[category];
    const tickers = CATEGORY_TICKERS[category] ?? [];
    const now = Date.now();
    return [
        {
            id: `e2e-market-news-${category}-1`,
            symbol: sentinel,
            source: 'E2E Wire',
            url: `http://localhost:4300/e2e/market-news/${category}/1`,
            publishedAt: new Date(now - MS_PER_DAY).toISOString(),
            titleEn: `E2E fixture ${category} headline one`,
            bodyEn: `Deterministic fixture body for the first E2E ${category} market-news article.`,
            tickers,
        },
        {
            id: `e2e-market-news-${category}-2`,
            symbol: sentinel,
            source: 'E2E Wire',
            url: `http://localhost:4300/e2e/market-news/${category}/2`,
            publishedAt: new Date(now - 2 * MS_PER_DAY).toISOString(),
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
