'use server';

import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import {
    submitNewsAnalysis,
    type EnrichedNewsItem,
    type SubmitNewsAnalysisOptions,
    type SubmitNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../lib/newsLookback';
import { isEnrichedRow, toEnrichedNewsItem } from '../lib/newsEnrichment';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/entities/analysis';
import { isBot } from '@/shared/api/isBot';
import type { AnalysisGateBlockedResult } from '@/domain/types';

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
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        const { db } = getDatabaseClient();
        const newsRepo = new DrizzleNewsRepository(db);

        const [rows, next] = await Promise.all([
            newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
            getNextEarningsReport(symbol, db),
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
            skipEnqueueIfMiss,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[submitNewsAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
