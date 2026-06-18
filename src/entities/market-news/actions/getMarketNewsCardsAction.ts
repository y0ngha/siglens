'use server';

import { getMarketNewsList } from '../api';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import type { MarketNewsCardItem } from '../lib/toCardItem';
import { toMarketNewsCardItem } from '../lib/toCardItem';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';

/**
 * Discriminated union result type for {@link getMarketNewsCardsAction}.
 *
 * Returns `ok: false` instead of throwing so the client polling hook can count
 * consecutive failures via the `ok: false` branch without an exception crossing
 * the network boundary (§0.7 — Server Actions must not surface raw DB errors
 * to the client).
 */
export type GetMarketNewsCardsResult =
    | { ok: true; items: MarketNewsCardItem[] }
    | { ok: false; error: string };

/**
 * Server Action: fetch the latest market-news card state from DB for a category.
 *
 * Called by `useMarketNewsCardPolling` and `useWaitForMarketNewsCards` on the
 * client to detect when pending cards (no sentiment / priceImpact) become
 * enriched by the background worker.
 * Intentionally NOT cached — each call must hit the DB to reflect the most
 * recent `attachAnalysis` writes.
 *
 * Uses `getMarketNewsList` (React.cache-memoized) to deduplicate concurrent
 * calls within the same RSC render pass or the same Server Action invocation.
 *
 * Projects rows through `toMarketNewsCardItem` (allowlist) so DB-internal columns
 * (bodyEn, symbol, analyzedAt) are never serialised into the Server Action response.
 */
export async function getMarketNewsCardsAction(
    category: NewsFeedCategory
): Promise<GetMarketNewsCardsResult> {
    try {
        const { sentinel } = CATEGORY_CONFIG[category];
        const rows = await getMarketNewsList(sentinel);
        return { ok: true, items: rows.map(toMarketNewsCardItem) };
    } catch (error) {
        console.error('[getMarketNewsCardsAction]', error);
        return { ok: false, error: 'db error' };
    }
}
