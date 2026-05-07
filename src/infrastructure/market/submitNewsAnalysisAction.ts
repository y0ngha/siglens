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
import { NEWS_ANALYSIS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import {
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/infrastructure/market/newsEnrichment';
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';

/** Server Action: load last-7d enriched news from DB + next earnings, then submit via siglens-core; returns `cached | submitted | error`. */
export async function submitNewsAnalysisAction(
    symbol: string,
    companyName: string,
    modelId: SubmitNewsAnalysisOptions['modelId']
): Promise<SubmitNewsAnalysisResult> {
    const { db } = getDatabaseClient();
    const newsRepo = new DrizzleNewsRepository(db);
    const calRepo = new DrizzleEarningsCalendarRepository(db);

    const [rows, next] = await Promise.all([
        newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
        calRepo.getNextForSymbol(symbol, todayKstIsoDate()),
    ]);

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
        .filter(isEnrichedRow)
        .map(toEnrichedNewsItem);

    // These logs include user-facing news content (titleKo, summaryKo) which
    // can leak into shared log aggregators. Gate behind an explicit debug
    // env flag so production logs stay clean. See .env.example.
    // Note: must NOT be NEXT_PUBLIC_* — that prefix inlines the value into the
    // client bundle, exposing the flag (and any future debug payloads it might
    // gate) to end users. This Server Action is server-only.
    if (process.env.DEBUG_VERBOSE_LOGS) {
        console.log(
            `[submitNewsAnalysisAction] symbol=${symbol} rows=${rows.length} enriched=${enrichedNews.length} lookbackMs=${NEWS_ANALYSIS_LOOKBACK_MS}`
        );
        if (rows.length > 0 && enrichedNews.length === 0) {
            const sample = rows[0];
            console.log(
                `[submitNewsAnalysisAction] enrichment 누락 sample — titleKo=${sample.titleKo} summaryKo=${sample.summaryKo} sentiment=${sample.sentiment} category=${sample.category}`
            );
        }
    }

    return submitNewsAnalysis({
        symbol,
        companyName,
        modelId,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        waitUntil,
    });
}
