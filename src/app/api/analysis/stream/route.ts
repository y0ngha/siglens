import type { ModelId, PositionBucket, Timeframe } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import { getDescriptor } from '@/shared/config/marketProfile';
import { getDatabaseClient } from '@/shared/db/client';
import {
    buildGateError,
    resolveTierAndByok,
    resolveTierOnly,
    resolveReasoning,
    resolvePositionBucket,
} from '@/shared/lib/byokGate';
import { heartbeatStream } from '@/shared/lib/sse/heartbeatStream';
import { runAnalysis, type RunAnalysisOptions } from './runAnalysisBridge';

export const dynamic = 'force-dynamic';

/**
 * Supported analysis type discriminants. Only `'technical'` is wired for now;
 * the others land in a later task as table entries in `DISPATCH`, not new files.
 */
type AnalysisType = 'technical';

type TechnicalParams = {
    symbol: string;
    companyName: string;
    timeframe: Timeframe;
    force?: boolean;
    fmpSymbol?: string;
    modelId?: ModelId;
    /**
     * Client-requested deep-thinking toggle. Honored only for member/pro tiers —
     * `resolveReasoning` forces `false` for anonymous/free callers regardless.
     */
    reasoning?: boolean;
};

type StreamRequestBody = { type: AnalysisType; params: TechnicalParams };

const SSE_HEADERS: HeadersInit = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform: asks CF/nginx not to buffer or modify the response body.
    'Cache-Control': 'no-cache, no-store, no-transform',
    // Disables nginx-family proxy response buffering (ALB, etc.).
    'X-Accel-Buffering': 'no',
};

/**
 * Resolves the position bucket for personalized analysis.
 *
 * ponytail: Logic mirrors `submitAnalysisAction.resolveHoldingPositionBucket` (private).
 * Cannot extract to `shared/` because FSD prohibits shared from importing entities/portfolio.
 * Refactor both call sites into `entities/analysis/lib/` when `runAnalysis` lands in core
 * and `submitAnalysisAction` is updated alongside.
 *
 * Degrades to `undefined` (no bucket, i.e. shared/base analysis) on ANY failure —
 * a holding-read or price-read error must never block the underlying analysis call.
 */
async function resolveHoldingPositionBucket(
    userId: string | null,
    tier: 'free' | 'member' | 'pro',
    symbol: string,
    fmpSymbol: string | undefined,
    marketDataProvider: {
        getQuote: (sym: string) => Promise<{ price?: number } | null>;
    }
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
        return resolvePositionBucket(tier, avgPrice, currentPrice ?? null);
    } catch (err) {
        console.error(
            '[streamAnalysisRoute] position bucket resolution failed, degrading to no-bucket:',
            err
        );
        return undefined;
    }
}

/**
 * POST /api/analysis/stream
 *
 * Runs a technical analysis via the SSE-native `runAnalysis` (replaces the
 * Redis submit/poll loop that required the now-deleted `siglens-worker`).
 *
 * Request body: `{ type: 'technical', params: { symbol, companyName, timeframe, ... } }`
 *
 * The `type` field is the extension point for future analysis kinds — adding one
 * means adding a row to the `DISPATCH` table (not a new file).
 *
 * Auth and tier/BYOK gating mirrors `submitAnalysisAction` exactly:
 * `getCurrentUser` → `resolveTierOnly`/`resolveTierAndByok` → `resolveReasoning` →
 * `resolveHoldingPositionBucket`. `request.signal` is forwarded to `runAnalysis`
 * so a dropped connection aborts the in-flight LLM call in core.
 */
export async function POST(request: Request): Promise<Response> {
    // --- 1. Parse and validate request body ---
    let body: StreamRequestBody;
    try {
        body = (await request.json()) as StreamRequestBody;
    } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 });
    }

    if (body.type !== 'technical') {
        return Response.json(
            { error: `unsupported analysis type: ${String(body.type)}` },
            { status: 400 }
        );
    }

    const {
        symbol,
        companyName,
        timeframe,
        force,
        fmpSymbol,
        modelId,
        reasoning,
    } = body.params;

    try {
        // --- 2. Auth ---
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        // --- 3. E2E short-circuit (mirrors submitAnalysisAction) ---
        if (isE2E()) {
            if (isBot(request.headers)) {
                return new Response(
                    heartbeatStream(
                        Promise.resolve({ status: 'miss_no_trigger' as const })
                    ),
                    { headers: SSE_HEADERS }
                );
            }
            const tier = await resolveTierOnly(userId);
            // Dynamic import keeps the E2E stub out of the prod bundle (dead code
            // when E2E_TEST is unset) — same guard as submitAnalysisAction.
            const { e2eCachedTechnical } =
                await import('@/shared/api/e2eAnalysisStub');
            return new Response(
                heartbeatStream(Promise.resolve(e2eCachedTechnical(tier))),
                { headers: SSE_HEADERS }
            );
        }

        // --- 4. Bot detection → skip enqueue on miss (no worker dispatch in SSE path) ---
        const skipEnqueueIfMiss = isBot(request.headers);

        // --- 5. Market profile → assetClass + session-aware data provider ---
        const marketProfile = await resolveMarketProfile(symbol);
        const assetClass = getDescriptor(marketProfile).assetClass;
        const marketDataProvider = getCachedMarketDataProvider(
            sessionSpecFor(marketProfile)
        );

        // --- 6. Tier + BYOK gate ---
        let tier: 'free' | 'member' | 'pro';
        let userApiKey: string | undefined;

        if (modelId === undefined) {
            tier = await resolveTierOnly(userId);
        } else {
            const gate = await resolveTierAndByok(userId, modelId);
            if (gate.kind === 'blocked') {
                return Response.json(
                    { status: 'error', error: gate.error },
                    { status: 403 }
                );
            }
            tier = gate.tier;
            userApiKey = gate.userApiKey;
        }

        // --- 7. Position bucket for personalized analysis ---
        const positionBucket = await resolveHoldingPositionBucket(
            userId,
            tier,
            symbol,
            fmpSymbol,
            marketDataProvider
        );

        // --- 8. Build work promise and stream ---
        const options: RunAnalysisOptions = {
            modelId,
            skipEnqueueIfMiss,
            marketDataProvider,
            assetClass,
            tierContext: { userId, tier },
            reasoning: resolveReasoning(tier, reasoning),
            positionBucket,
            ...(userApiKey !== undefined ? { userApiKey } : {}),
            signal: request.signal,
        };

        const work = runAnalysis(
            symbol,
            companyName,
            timeframe,
            force,
            fmpSymbol,
            options
        );

        return new Response(heartbeatStream(work), { headers: SSE_HEADERS });
    } catch (err) {
        console.error('[streamAnalysisRoute] unexpected error:', err);
        return Response.json(
            { status: 'error', error: buildGateError('unexpected_error') },
            { status: 500 }
        );
    }
}
