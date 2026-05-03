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
import {
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/infrastructure/market/newsEnrichment';
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';

/** Server Action: load last-7d enriched news from DB + next earnings, then submit via siglens-core; returns `cached | submitted | error`. */
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
