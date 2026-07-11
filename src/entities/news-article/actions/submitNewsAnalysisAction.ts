'use server';

import { headers } from 'next/headers';
import {
    submitNewsAnalysis,
    type EnrichedNewsItem,
    type SubmitNewsAnalysisOptions,
    type SubmitNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../lib/newsLookback';
import { buildAnalysisNewsItems } from '../lib/buildAnalysisNewsItems';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { resolveAssetClass } from '@/entities/ticker/lib/resolveAssetClass';

/** Final return type — core's news result + our siglens-side gate errors. */
export type SubmitNewsAnalysisActionResult =
    | SubmitNewsAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then load last-7d enriched news from DB + next earnings, then submit via siglens-core; returns `cached | submitted | error`. */
export async function submitNewsAnalysisAction(
    symbol: string,
    companyName: string,
    modelId: SubmitNewsAnalysisOptions['modelId'],
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers.
     */
    reasoning?: boolean
): Promise<SubmitNewsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // submitAnalysisAction).
        if (isE2E()) {
            const { e2eCachedNews } =
                await import('@/shared/api/e2eAnalysisStub');
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

        const assetClass = await resolveAssetClass(symbol);
        const { db } = getDatabaseClient();
        const newsRepo = new DrizzleNewsRepository(db);

        const [rows, next] = await Promise.all([
            newsRepo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
            getNextEarningsReport(symbol, db),
        ]);

        // The per-card stage and 30-day window above are untouched — buildAnalysisNewsItems
        // bounds what the aggregate prompt sees(top 25 by priceImpact). 동일 pipeline을
        // submitOverallAnalysisAction이 공유해 news axis cache가 같은 키로 hit한다.
        const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
            buildAnalysisNewsItems(rows);

        return await submitNewsAnalysis({
            symbol,
            companyName,
            modelId,
            news: enrichedNews,
            upcomingCalendar: next !== null ? [next] : [],
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            skipEnqueueIfMiss,
            assetClass,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[submitNewsAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
