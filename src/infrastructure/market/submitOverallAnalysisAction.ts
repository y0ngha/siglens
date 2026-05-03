'use server';

import { waitUntil } from '@vercel/functions';
import {
    submitOverallAnalysis,
    type EnrichedNewsItem,
    type SubmitOverallAnalysisOptions,
    type SubmitOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';
import type { NewsRow } from '@/infrastructure/db/newsRepository';

/**
 * Lookback window used when querying recent news for the overall analysis.
 * 7 days expressed in milliseconds, matching the `NewsTimeRange` `'7d'` window.
 */
const NEWS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Type predicate: narrows a `NewsRow` to `EnrichedNewsItem`.
 *
 * A row is considered fully enriched when it has a translated title (`titleKo`),
 * a summary (`summaryKo`), a non-null sentiment, and a non-null category.
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
 * Server Action: submit an overall (3-axis) analysis job for the given symbol.
 *
 * Loads the last 7 days of news from the DB, filters to fully-analyzed cards,
 * looks up the next upcoming earnings event, then delegates to
 * `submitOverallAnalysis` from siglens-core with an FMP-backed fundamental
 * provider.
 *
 * The `technical` axis options are left empty (pre-Phase 4 behavior); tier and
 * usage checks are skipped until Phase 4.
 *
 * @param symbol    - U.S. equity ticker (e.g. `"AAPL"`).
 * @param timeframe - Bar resolution for the technical analysis axis.
 * @param modelId   - LLM model identifier scoped across all three axes.
 * @returns Submission outcome — `cached`, `submitted`, `pending_dependencies`, or `error`.
 */
export async function submitOverallAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId']
): Promise<SubmitOverallAnalysisResult> {
    const { db } = getDatabaseClient();
    const newsRepo = new DrizzleNewsRepository(db);
    const calRepo = new DrizzleEarningsCalendarRepository(db);

    const [rows, next] = await Promise.all([
        newsRepo.listBySymbol(symbol, NEWS_LOOKBACK_MS),
        calRepo.getNextForSymbol(symbol, new Date().toISOString().slice(0, 10)),
    ]);

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
        .filter(isEnrichedRow)
        .map((row) => ({
            id: row.id,
            symbol: row.symbol,
            source: row.source,
            url: row.url,
            publishedAt: row.publishedAt,
            titleEn: row.titleEn,
            bodyEn: row.bodyEn,
            card: {
                titleKo: row.titleKo as string,
                bodyKo: row.bodyKo,
                summaryKo: row.summaryKo as string,
                sentiment: row.sentiment as EnrichedNewsItem['card']['sentiment'],
                category: row.category as EnrichedNewsItem['card']['category'],
            },
        }));

    return submitOverallAnalysis({
        symbol,
        timeframe,
        modelId,
        fundamentalProvider: new FmpFundamentalClient(),
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        // Pre-Phase 4: no tier/usage/userApiKey overrides needed.
        technical: {},
        waitUntil,
    });
}
