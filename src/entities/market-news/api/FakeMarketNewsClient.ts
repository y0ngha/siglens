import { MS_PER_DAY } from '@/shared/config/time';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import type {
    MarketNewsClientPort,
    MarketNewsItem,
} from '../lib/marketNewsClientPort';

const CATEGORY_TICKERS: Partial<Record<NewsFeedCategoryId, string[]>> = {
    crypto: ['BTCUSD'],
    stock: ['AAPL'],
};

/**
 * 카테고리별 결정적 E2E 픽스처 기사 2건(sentinel·샘플 티커 포함). E2E DB 시드
 * (`e2e/setup/seed.ts`)가 같은 데이터로 `market_news`를 미리 채워, 첫 방문 SSR에서
 * 콜드 스타트 적재 경합 없이 카드가 렌더되게 한다.
 *
 * 시각은 `Date.now()` 기준 상대값(1·2일 전)이라 서버의 `MARKET_NEWS_LOOKBACK_DAYS`(7일)
 * 창 안에 항상 들어온다. 과거 고정 날짜(2026-05-29)는 시간이 지나며 창 밖으로 밀려
 * `getMarketNewsList`가 빈 결과를 반환 → 카드 미렌더로 E2E가 깨졌다(time-rot).
 * 타이틀은 불변이다.
 */
export function makeFakeItems(category: NewsFeedCategoryId): MarketNewsItem[] {
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

/**
 * E2E 전용 클라이언트 — FMP 대신 `makeFakeItems` 픽스처를 돌려준다. `E2E_TEST=1`일 때만
 * `getMarketNewsClient`가 고른다. env 키를 읽지 않고 네트워크 I/O도 하지 않는다.
 */
export class FakeMarketNewsClient implements MarketNewsClientPort {
    async fetchCategoryNews(
        category: NewsFeedCategoryId,
        _lookbackMs: number
    ): Promise<MarketNewsItem[]> {
        return makeFakeItems(category);
    }
}
