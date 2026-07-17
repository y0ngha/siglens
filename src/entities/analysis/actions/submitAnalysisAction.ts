'use server';

import { headers } from 'next/headers';
import {
    submitAnalysis,
    type MarketDataProvider,
    type ModelId,
    type PositionBucket,
    type SubmitAnalysisGatedResult,
    type Tier,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import {
    resolveTierAndByok,
    resolveTierOnly,
    resolveReasoning,
    resolvePositionBucket,
    buildGateError,
} from '@/shared/lib/byokGate';
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

/**
 * Server-reads the member's holding for `symbol` (if any) plus the current
 * cached price, then derives a coarse position bucket via
 * `resolvePositionBucket` (personalized-analysis-by-position-bucket spec,
 * Subsystem C). The average price NEVER comes from the client — it is
 * re-read from the DB on every call, which is the whole point: a
 * client-passed avg would be spoofable and would poison the shared analysis
 * cache (the bucket folds into `buildAnalysisCacheKey`).
 *
 * Skips the DB/price reads entirely for anonymous or free-tier callers (free
 * tier never gets a bucket — mirrors `resolveReasoning`), and degrades to
 * `undefined` (no bucket, i.e. the shared/base analysis) on ANY failure —
 * a holding-read or price-read error must never block the underlying
 * analysis submission.
 *
 * The current price comes from `marketDataProvider.getQuote` — the same
 * Redis-cached quote (`quote:<SYMBOL>`, session-aware TTL) that
 * `CachedMarketDataProvider` already serves for bars/today-quote reads, so
 * this is normally a warm cache hit rather than a fresh FMP call. It is a
 * real added dependency on every member-with-holding submit (even one that
 * would otherwise be a pure cache hit on the analysis itself), but reusing
 * the existing cached quote keeps the cost bounded. Note this is a close
 * PROXY, not a guaranteed match: the quote cache can drift intraday from the
 * analysis snapshot's own last-bar close (different TTLs/fetch times), so the
 * position bucket can occasionally disagree with the price a user sees in
 * the snapshot by a small margin. Acceptable for a coarse ~5-band bucket.
 */
async function resolveHoldingPositionBucket(
    userId: string | null,
    tier: Tier,
    symbol: string,
    fmpSymbol: string | undefined,
    marketDataProvider: MarketDataProvider
): Promise<PositionBucket | undefined> {
    if (tier === 'free' || userId === null) return undefined;
    try {
        const { db } = getDatabaseClient();
        const holding = await new DrizzlePortfolioRepository(
            db
        ).findByUserAndSymbol(userId, symbol.toUpperCase());
        if (holding === null) return undefined;

        const avgPrice = Number(holding.averagePrice);
        const quote = await marketDataProvider.getQuote(fmpSymbol ?? symbol);
        const currentPrice = quote?.price ?? null;

        return resolvePositionBucket(tier, avgPrice, currentPrice);
    } catch (error) {
        console.error(
            '[submitAnalysisAction] position bucket resolution failed, degrading to no-bucket:',
            error
        );
        return undefined;
    }
}

/** 서버사이드 tier + BYOK 게이트 후 core의 submitAnalysis에 위임. */
export async function submitAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string,
    modelId?: ModelId,
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers — `resolveReasoning` forces
     * `false` for anonymous/free callers regardless of this value.
     */
    reasoning?: boolean
): Promise<SubmitAnalysisActionResult> {
    try {
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

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
            const tier = await resolveTierOnly(userId);
            const { e2eCachedTechnical } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedTechnical(tier);
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

        if (modelId === undefined) {
            const tier = await resolveTierOnly(userId);
            const positionBucket = await resolveHoldingPositionBucket(
                userId,
                tier,
                symbol,
                fmpSymbol,
                marketDataProvider
            );
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
                    tierContext: { userId, tier },
                    reasoning: resolveReasoning(tier, reasoning),
                    positionBucket,
                }
            );
        }

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        const positionBucket = await resolveHoldingPositionBucket(
            userId,
            gate.tier,
            symbol,
            fmpSymbol,
            marketDataProvider
        );

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
                reasoning: resolveReasoning(gate.tier, reasoning),
                positionBucket,
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
