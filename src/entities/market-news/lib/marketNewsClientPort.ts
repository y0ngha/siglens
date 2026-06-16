import type { NewsFeedCategory, NewsItem } from '@y0ngha/siglens-core';

/** A market-news article: core NewsItem plus the article's own display tickers. */
export interface MarketNewsItem extends NewsItem {
    /** Stock/crypto/forex tickers from the feed; [] for general/articles. */
    tickers: string[];
}

export interface MarketNewsClientPort {
    /** Fetch the category's market-wide feed within the lookback window. */
    fetchCategoryNews(
        category: NewsFeedCategory,
        lookbackMs: number
    ): Promise<MarketNewsItem[]>;
}
