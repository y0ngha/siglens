'use server';

import { headers } from 'next/headers';
import {
    submitMarketNewsDigest,
    type EnrichedNewsItem,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import type { SubmitMarketNewsDigestActionResult } from './submitMarketNewsDigestActionTypes';
import { isBot } from '@/shared/api/isBot';
import { getMarketNewsList } from '../api';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import {
    isEnrichedRow,
    selectAggregateNewsItems,
    toEnrichedNewsItem,
} from '@/entities/news-article';
import type { MarketNewsRow } from '../model';

/**
 * Picks only the fields that `isEnrichedRow` / `toEnrichedNewsItem` inspect.
 * Explicit mapping surfaces any future shape drift between the two entities
 * as a compile-time TS error rather than a silent runtime mismatch.
 */
function toEnrichedRowShape(
    row: MarketNewsRow
): Parameters<typeof isEnrichedRow>[0] {
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        bodyEn: row.bodyEn,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
        priceImpact: row.priceImpact,
        analyzedAt: row.analyzedAt,
    };
}

function toEnrichedMarketNewsItem(row: MarketNewsRow): EnrichedNewsItem | null {
    const shaped = toEnrichedRowShape(row);
    if (!isEnrichedRow(shaped)) return null;
    return toEnrichedNewsItem(shaped);
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
): Promise<SubmitMarketNewsDigestActionResult> {
    try {
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const { sentinel, koLabel } = CATEGORY_CONFIG[category];
        const rows = await getMarketNewsList(sentinel);

        const enrichedItems: EnrichedNewsItem[] = rows
            .map(toEnrichedMarketNewsItem)
            .filter((item): item is EnrichedNewsItem => item !== null);

        // Cap to the top market-moving items to keep the digest prompt bounded.
        const news = selectAggregateNewsItems(enrichedItems);

        return await submitMarketNewsDigest({
            category,
            categoryLabel: koLabel,
            modelId: DEFAULT_DIGEST_MODEL_ID,
            news,
            skipEnqueueIfMiss,
        });
    } catch (error) {
        console.error('[submitMarketNewsDigestAction]', error);
        return { status: 'error', error: 'Failed to submit digest' };
    }
}
