'use server';

import { waitUntil } from '@vercel/functions';
import {
    submitNewsAnalysis,
    type EnrichedNewsItem,
    type SubmitNewsAnalysisOptions,
    type SubmitNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';
import { NEWS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import { todayKstIsoDate } from '@/lib/dateKey';
import type { NewsRow } from '@/infrastructure/db/newsRepository';

/**
 * Type predicate: narrows a `NewsRow` to `EnrichedNewsItem`.
 *
 * A row is considered fully enriched when it has a translated title (`titleKo`),
 * a summary (`summaryKo`), a non-null sentiment, and a non-null category — the
 * four fields written by the per-card LLM analysis step.
 *
 * @internal
 */
function isEnrichedRow(row: NewsRow): row is NewsRow & EnrichedNewsItem {
    return (
        row.titleKo !== null &&
        row.summaryKo !== null &&
        row.sentiment !== null &&
        row.category !== null
    );
}

/**
 * Server Action: submit a news analysis job for the given symbol.
 *
 * Loads the last 7 days of news from the DB, filters to fully-analyzed cards,
 * looks up the next upcoming earnings event, then delegates to
 * `submitNewsAnalysis` from siglens-core.
 *
 * @param symbol  - U.S. equity ticker (e.g. `"AAPL"`).
 * @param modelId - LLM model identifier used for analysis and cache scoping.
 * @returns Submission outcome — `cached`, `submitted`, or `error`.
 */
export async function submitNewsAnalysisAction(
    symbol: string,
    modelId: SubmitNewsAnalysisOptions['modelId']
): Promise<SubmitNewsAnalysisResult> {
    const { db } = getDatabaseClient();
    const newsRepo = new DrizzleNewsRepository(db);
    const calRepo = new DrizzleEarningsCalendarRepository(db);

    const [rows, next] = await Promise.all([
        newsRepo.listBySymbol(symbol, NEWS_LOOKBACK_MS),
        calRepo.getNextForSymbol(symbol, todayKstIsoDate()),
    ]);

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
        .filter(isEnrichedRow)
        .map(row => ({
            id: row.id,
            symbol: row.symbol,
            source: row.source,
            url: row.url,
            publishedAt: row.publishedAt,
            titleEn: row.titleEn,
            bodyEn: row.bodyEn,
            card: {
                // isEnrichedRow predicate above guarantees titleKo is non-null at runtime
                titleKo: row.titleKo as string,
                bodyKo: row.bodyKo,
                // isEnrichedRow predicate above guarantees summaryKo is non-null at runtime
                summaryKo: row.summaryKo as string,
                // isEnrichedRow predicate above guarantees sentiment is one of NewsSentiment literals
                sentiment:
                    row.sentiment as EnrichedNewsItem['card']['sentiment'],
                // isEnrichedRow predicate above guarantees category is one of NewsCategory literals
                category: row.category as EnrichedNewsItem['card']['category'],
            },
        }));

    return submitNewsAnalysis({
        symbol,
        modelId,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        waitUntil,
    });
}
