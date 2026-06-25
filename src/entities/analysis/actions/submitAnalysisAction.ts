'use server';

import { headers } from 'next/headers';
import {
    submitAnalysis,
    type ModelId,
    type SubmitAnalysisGatedResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';

/** Final return type — core's gated result + our siglens-side gate errors. */
export type SubmitAnalysisActionResult =
    | SubmitAnalysisGatedResult
    | AnalysisGateBlockedResult;

/** 서버사이드 tier + BYOK 게이트 후 core의 submitAnalysis에 위임. */
export async function submitAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string,
    modelId?: ModelId
): Promise<SubmitAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker (see e2eAnalysisStub). The
        // short-circuit stays bot-aware so the crawler path (miss_no_trigger →
        // BotBlockedNotice) remains reachable under E2E: a bot User-Agent yields
        // the core MissNoTrigger shape just like prod's skipEnqueueIfMiss + cache
        // miss, while a normal UA gets the deterministic cached fixture. Lives
        // inside try so `await headers()` can't propagate a throw to the client.
        // Only this (chart/technical) action does the E2E bot check: it's the
        // sole analysis surface that renders BotBlockedNotice, so it's the only
        // miss_no_trigger path worth exercising. The fundamental/news/options/
        // overall submit actions have no bot-block UI, so they intentionally skip
        // the check and always return their cached fixture.
        // The stub + JSON fixture load via a DYNAMIC import under the E2E guard, so
        // they sit in a lazy chunk (not the prod main bundle) and the branch stays
        // resolvable by the vitest runner. Dead when E2E_TEST is unset.
        if (isE2E()) {
            const requestHeaders = await headers();
            if (isBot(requestHeaders)) return { status: 'miss_no_trigger' };
            const { e2eCachedTechnical } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedTechnical();
        }

        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);
        // Resolve profile once; derive both assetClass and session spec from it
        // to avoid a lossy assetClass→profileId round-trip at the sessionSpecFor call.
        const marketProfile = await resolveMarketProfile(symbol);
        const assetClass = getDescriptor(marketProfile).assetClass;
        const marketDataProvider = getCachedMarketDataProvider(
            sessionSpecFor(marketProfile)
        );

        // no user lookup needed when modelId is absent
        if (modelId === undefined) {
            return await submitAnalysis(
                symbol,
                companyName,
                timeframe,
                force,
                fmpSymbol,
                {
                    modelId,
                    skipEnqueueIfMiss,
                    marketDataProvider,
                    assetClass,
                }
            );
        }

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await submitAnalysis(
            symbol,
            companyName,
            timeframe,
            force,
            fmpSymbol,
            {
                modelId,
                skipEnqueueIfMiss,
                marketDataProvider,
                assetClass,
                tierContext: { userId, tier: gate.tier },
                ...(gate.userApiKey !== undefined
                    ? { userApiKey: gate.userApiKey }
                    : {}),
            }
        );
    } catch (err) {
        console.error('[submitAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
