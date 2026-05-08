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
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import {
    resolveTierAndByok,
    buildGateError,
} from '@/infrastructure/market/byokGate';
import type { AnalysisGateBlockedResult } from '@/domain/types';

/** Final return type — core's overall result + our siglens-side gate errors. */
export type SubmitOverallAnalysisActionResult =
    | SubmitOverallAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then submit a 3-axis overall analysis job; loads enriched news + earnings from DB, injects FMP provider; returns `cached | submitted | pending_dependencies | error`. */
export async function submitOverallAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId']
): Promise<SubmitOverallAnalysisActionResult> {
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
            newsRepo.listBySymbol(symbol, NEWS_LOOKBACK_MS),
            calRepo.getNextForSymbol(symbol, todayKstIsoDate()),
        ]);

        const enrichedNews: ReadonlyArray<EnrichedNewsItem> = rows
            .filter(isEnrichedRow)
            .map(toEnrichedNewsItem);

        return await submitOverallAnalysis({
            symbol,
            companyName,
            timeframe,
            modelId,
            fundamentalProvider: new FmpFundamentalClient(),
            newsItems: enrichedNews,
            upcomingCalendar: next !== null ? [next] : [],
            technical: { tierContext: { userId, tier: gate.tier } },
            waitUntil,
            tier: gate.tier,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[submitOverallAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
