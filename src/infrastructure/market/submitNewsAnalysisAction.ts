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
import { isEnrichedRow, toEnrichedNewsItem } from '@/infrastructure/market/newsEnrichment';
import { todayKstIsoDate } from '@/lib/dateKey';

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
        .map(toEnrichedNewsItem);

    return submitNewsAnalysis({
        symbol,
        modelId,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        waitUntil,
    });
}
