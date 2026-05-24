'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import type { NewsDisplayItem } from '@/domain/types';

/**
 * Server Action: fetch the latest per-card analysis state from DB.
 *
 * Called by `useNewsCardPolling` on the client to detect when pending cards
 * (no sentiment / priceImpact) become enriched by the background worker.
 * Intentionally NOT cached — each call must hit the DB to reflect the
 * most recent `attachAnalysis` writes.
 */
export async function getNewsCardsAction(
    symbol: string
): Promise<NewsDisplayItem[]> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    const rows = await repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
    return rows.map(
        ({
            id,
            publishedAt,
            titleEn,
            titleKo,
            sentiment,
            category,
            bodyKo,
            summaryKo,
            priceImpact,
            url,
            source,
        }) => ({
            id,
            publishedAt,
            titleEn,
            titleKo,
            sentiment,
            category,
            bodyKo,
            summaryKo,
            priceImpact,
            url,
            source,
        })
    );
}
