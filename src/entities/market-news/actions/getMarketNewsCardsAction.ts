'use server';

import { getMarketNewsList } from '../api';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import type { NewsDisplayItem } from '@/shared/lib/types';

/**
 * Market-news display card — `NewsDisplayItem` plus `tickers` for display chips.
 * Intentionally narrow: only what the client needs for rendering; DB-internal
 * fields (bodyEn, symbol, analyzedAt) are excluded.
 */
export interface MarketNewsCardItem extends NewsDisplayItem {
    /** Article's own ticker symbols for display chips; `[]` for general/articles. */
    tickers: string[];
}

/**
 * Server Action: fetch the latest market-news card state from DB for a category.
 *
 * Called by `useMarketNewsCardPolling` on the client to detect when pending
 * cards (no sentiment / priceImpact) become enriched by the background worker.
 * Intentionally NOT cached — each call must hit the DB to reflect the most
 * recent `attachAnalysis` writes.
 *
 * Uses `getMarketNewsList` (React.cache memoized within a render tree) so
 * concurrent RSC + action calls within the same request share a single DB round-trip.
 */
export async function getMarketNewsCardsAction(
    category: NewsFeedCategory
): Promise<MarketNewsCardItem[]> {
    const { sentinel } = CATEGORY_CONFIG[category];
    const rows = await getMarketNewsList(sentinel);

    // Allowlist: only expose client-safe display fields.
    // DB-internal fields (bodyEn, symbol, analyzedAt) stay server-side.
    return rows.map(
        ({
            id,
            publishedAt,
            titleEn,
            titleKo,
            sentiment,
            category: newsCategory,
            bodyKo,
            summaryKo,
            priceImpact,
            url,
            source,
            tickers,
        }) => ({
            id,
            publishedAt,
            titleEn,
            titleKo,
            sentiment,
            category: newsCategory,
            bodyKo,
            summaryKo,
            priceImpact,
            url,
            source,
            tickers,
        })
    );
}
