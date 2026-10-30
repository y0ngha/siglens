import type { NewsFeedCategoryId } from './categoryConfig';
import type { NewsItem } from '@y0ngha/siglens-core';

/** 시장 뉴스 기사 — core `NewsItem`에 기사 자체의 표시용 티커를 더한 것. */
export interface MarketNewsItem extends NewsItem {
    /** 피드가 준 주식/암호화폐/외환 티커. general/articles는 `[]`. */
    tickers: string[];
}

/** 카테고리 시장 피드 소스 어댑터의 계약. `getMarketNewsClient`가 카테고리별로 구현체를 고른다. */
export interface MarketNewsClientPort {
    /** lookback 창 안의 카테고리 시장 피드를 받아 온다. */
    fetchCategoryNews(
        category: NewsFeedCategoryId,
        lookbackMs: number
    ): Promise<MarketNewsItem[]>;
}
