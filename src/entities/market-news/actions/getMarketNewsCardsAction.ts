'use server';

import { getMarketNewsList } from '../api';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import { toMarketNewsCardItem } from '../lib/toCardItem';
import type { MarketNewsCardItem } from '../lib/toCardItem';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';

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
 *
 * Projects rows through `toMarketNewsCardItem` (allowlist) so DB-internal columns
 * (bodyEn, symbol, analyzedAt) are never serialised into the Server Action response.
 */
export async function getMarketNewsCardsAction(
    category: NewsFeedCategory
): Promise<MarketNewsCardItem[]> {
    const { sentinel } = CATEGORY_CONFIG[category];
    const rows = await getMarketNewsList(sentinel);
    return rows.map(toMarketNewsCardItem);
}
