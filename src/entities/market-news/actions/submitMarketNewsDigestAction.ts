'use server';

import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import {
    submitMarketNewsDigest,
    type SubmitMarketNewsDigestResult,
} from '@y0ngha/siglens-core';
import type { EnrichedNewsItem, NewsFeedCategory } from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';
import { getMarketNewsList } from '../api';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import {
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/entities/news-article/lib/newsEnrichment';
import { selectAggregateNewsItems } from '@/entities/news-article/lib/newsAnalysisSelection';
import type { MarketNewsRow } from '../model';

/**
 * Coerce a `MarketNewsRow` into the `NewsRow`-compatible shape that
 * `isEnrichedRow` and `toEnrichedNewsItem` expect. `MarketNewsRow` is a
 * structural superset of `NewsRow` (same fields + `tickers`), so only a
 * type assertion is required — no field mapping.
 *
 * The `tickers` extra field is silently ignored by both helpers.
 */
function toEnrichedMarketNewsItem(row: MarketNewsRow): EnrichedNewsItem | null {
    const newsRowLike = row as Parameters<typeof isEnrichedRow>[0];
    if (!isEnrichedRow(newsRowLike)) return null;
    return toEnrichedNewsItem(newsRowLike);
}

/**
 * Server Action: submit a market-news category digest job.
 *
 * No tier/BYOK gate — the category digest is public and uses a fixed shared
 * model. Reads enriched rows from DB, maps through `isEnrichedRow`, caps via
 * `selectAggregateNewsItems`, and delegates to core `submitMarketNewsDigest`.
 *
 * Bot traffic sets `skipEnqueueIfMiss: true` so crawler requests return
 * `miss_no_trigger` without dispatching a worker job.
 */
export async function submitMarketNewsDigestAction(
    category: NewsFeedCategory
): Promise<SubmitMarketNewsDigestResult> {
    const requestHeaders = await headers();
    const skipEnqueueIfMiss = isBot(requestHeaders);

    const { sentinel, koLabel } = CATEGORY_CONFIG[category];
    const rows = await getMarketNewsList(sentinel);

    // Filter to rows that have been fully enriched by the per-card LLM pass.
    const enrichedItems: EnrichedNewsItem[] = rows
        .map(toEnrichedMarketNewsItem)
        .filter((item): item is EnrichedNewsItem => item !== null);

    // Cap to the top market-moving items to keep the digest prompt bounded.
    const news = selectAggregateNewsItems(enrichedItems);

    return submitMarketNewsDigest({
        category,
        categoryLabel: koLabel,
        modelId: DEFAULT_DIGEST_MODEL_ID,
        news,
        skipEnqueueIfMiss,
        waitUntil,
    });
}
