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
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';

/** Server Action: submit a 3-axis overall analysis job; loads enriched news + earnings from DB, injects FMP provider; returns `cached | submitted | pending_dependencies | error`. */
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
