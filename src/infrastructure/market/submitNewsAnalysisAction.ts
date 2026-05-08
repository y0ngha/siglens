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
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import {
    resolveTierAndByok,
    buildGateError,
    type AnalysisGateBlockedResult,
} from '@/infrastructure/market/byokGate';

// Re-export for consumers
export type { AnalysisGateBlockedResult };

/** Final return type — core's news result + our siglens-side gate errors. */
export type SubmitNewsAnalysisActionResult =
    | SubmitNewsAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then load last-7d enriched news from DB + next earnings, then submit via siglens-core; returns `cached | submitted | error`. */
export async function submitNewsAnalysisAction(
    symbol: string,
    companyName: string,
    modelId: SubmitNewsAnalysisOptions['modelId']
): Promise<SubmitNewsAnalysisActionResult> {
    try {
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

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

        return await submitNewsAnalysis({
            symbol,
            companyName,
            modelId,
            news: enrichedNews,
            upcomingCalendar: next !== null ? [next] : [],
            waitUntil,
            tier: gate.tier,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch {
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
