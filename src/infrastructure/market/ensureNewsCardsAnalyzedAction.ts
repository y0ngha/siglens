'use server';

import { submitNewsCardAnalysis } from '@y0ngha/siglens-core';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';

/**
 * Server Action: fetch fresh news from FMP, upsert each item to the DB,
 * and trigger per-card flash-lite analysis (one-shot).
 *
 * Called as fire-and-forget on news page entry — the page renders with
 * whatever rows are already in the DB; subsequent loads benefit from the
 * freshly analysed cards.
 *
 * Error handling:
 * - FMP or DB failures are caught per-item and logged; the action always
 *   resolves without throwing so the caller's `void` dispatch is safe.
 *
 * @param symbol - Uppercased U.S. equity ticker (e.g. `"AAPL"`).
 */
export async function ensureNewsCardsAnalyzedAction(
    symbol: string
): Promise<void> {
    const newsClient = new FmpNewsClient();
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    let fresh;
    try {
        fresh = await newsClient.fetchNews(symbol, '7d');
    } catch (err) {
        console.error('[ensureNewsCardsAnalyzedAction] FMP fetch failed:', err);
        return;
    }

    for (const item of fresh) {
        try {
            await repo.upsertNewsItem(item);
        } catch (err) {
            console.error(
                `[ensureNewsCardsAnalyzedAction] upsert failed for ${item.id}:`,
                err
            );
            // Continue to next item — one DB failure should not block the rest.
            continue;
        }

        try {
            const result = await submitNewsCardAnalysis({ item });
            if (result.status === 'cached') {
                await repo.attachAnalysis(item.id, result.result, new Date());
            }
            // 'submitted' case: worker processes async; next page load picks
            // up the result from the per-card Redis cache via the DB.
        } catch (err) {
            console.error(
                `[ensureNewsCardsAnalyzedAction] card analysis failed for ${item.id}:`,
                err
            );
        }
    }
}
