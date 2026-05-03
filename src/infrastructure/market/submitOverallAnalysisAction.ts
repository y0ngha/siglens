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
import { NEWS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import {
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/infrastructure/market/newsEnrichment';
import { todayKstIsoDate } from '@/lib/dateKey';

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
        calRepo.getNextForSymbol(symbol, todayKstIsoDate()),
    ]);

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
        .filter(isEnrichedRow)
        .map(toEnrichedNewsItem);

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
