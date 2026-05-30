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
import { selectAggregateNewsItems } from '../lib/newsAnalysisSelection';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

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
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture are require'd (not statically
        // imported) under the inline E2E guard so they stay out of the production
        // bundle (matches getMarketDataProvider). Lives inside try so a require()
        // throw can't propagate to the client (mirrors submitAnalysisAction).
        if (process.env.E2E_TEST === '1') {
            const { e2eCachedNews } =
                require('@/shared/api/e2eAnalysisStub') as typeof import('@/shared/api/e2eAnalysisStub');
            return e2eCachedNews();
        }
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

        // The per-card stage and 30-day window above are untouched — this only
        // bounds what the aggregate prompt sees.
        const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
            selectAggregateNewsItems(
                rows.filter(isEnrichedRow).map(toEnrichedNewsItem)
            );

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
