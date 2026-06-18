import type { NewsDisplayItem } from '@/shared/lib/types';

export type { NewsFeedCategory } from '@y0ngha/siglens-core';

/**
 * Row from the `market_news` table — display projection + persistence fields + tickers.
 * Extends `NewsDisplayItem` with fields that are present in the DB row but
 * not surfaced as display-only metadata.
 */
export interface MarketNewsRow extends NewsDisplayItem {
    /** Original English body — needed for re-analysis but not displayed directly. */
    bodyEn: string | null;
    /** Sentinel bucket symbol (e.g. `__NEWS_CRYPTO__`). Never shown in a URL. */
    symbol: string;
    /** Article's own ticker symbols for display chips; `[]` for general/articles. */
    tickers: string[];
    /** Timestamp the LLM analysis was attached; null before analysis. */
    analyzedAt: Date | null;
}
