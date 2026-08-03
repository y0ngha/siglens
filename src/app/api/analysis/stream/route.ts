import type {
    CalendarImpact,
    ModelId,
    NewsFeedCategory,
    NewsItem,
    PositionBucket,
    Timeframe,
} from '@y0ngha/siglens-core';
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
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { heartbeatStream } from '@/shared/lib/sse/heartbeatStream';
import {
    runAnalysis,
    runNewsCardAnalysis,
    runEconomicEventAnalysis,
    runIndicatorTranslation,
    type SubmitAnalysisOptions,
} from './runAnalysisBridge';

// Actions: gating + data-fetch already live in each entity's action file.
// Calling them from the route (server-side) is safe — no browser connection means
// no ALB idle_timeout. The SSE heartbeat stream keeps the browser connection alive
// while these actions await the LLM.
import {
    runOverallAnalysisAction,
    runFundamentalAnalysisAction,
    runFinancialsAnalysisAction,
    runCongressTrendAction,
} from '@/entities/analysis/actions';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions';
import { submitMarketNewsDigestAction } from '@/entities/market-news/actions/submitMarketNewsDigestAction';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions/submitMarketBriefingAction';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';

export const dynamic = 'force-dynamic';

/**
 * All analysis kind discriminants supported by this SSE route. `technical` is
 * handled inline (it does complex multi-step gating + position-bucket
 * personalization). The remaining twelve are dispatched through `DISPATCH`.
 */
type AnalysisType =
    | 'technical'
    | 'overall'
    | 'fundamental'
    | 'financials'
    | 'news'
    | 'newsCard'
    | 'marketNewsDigest'
    | 'options'
    | 'congress'
    | 'briefing'
    | 'macroBriefing'
    | 'economicEvent'
    | 'indicatorTranslation';

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

/**
 * SSE route request body. `technical` carries a fully-typed `TechnicalParams`
 * shape; all other types pass through as `Record<string, unknown>` because each
 * has a distinct shape and they are validated by the action they delegate to.
 */
type StreamRequestBody =
    | { type: 'technical'; params: TechnicalParams }
    | {
          type: Exclude<AnalysisType, 'technical'>;
          params: Record<string, unknown>;
      };

const SSE_HEADERS: HeadersInit = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform: asks CF/nginx not to buffer or modify the response body.
    'Cache-Control': 'no-cache, no-store, no-transform',
    // Disables nginx-family proxy response buffering (ALB, etc.).
    'X-Accel-Buffering': 'no',
};

/**
 * Dispatch table: maps each non-technical analysis type to a function that
 * receives the raw `params` bag and returns a Promise. The returned promise is
 * piped into `heartbeatStream`, keeping the browser SSE connection alive for
 * the full LLM round-trip. Each entry delegates to the entity action that
 * already owns auth, tier/BYOK gating, E2E short-circuit, bot detection, and
 * data-fetch — no logic is duplicated here.
 *
 * `newsCard`, `economicEvent`, `indicatorTranslation` have no client hook yet
 * and no action with the right signature, so they call core directly via the
 * bridge. These are wired for future use and for server-to-server SSE calls.
 */
const DISPATCH: Record<
    Exclude<AnalysisType, 'technical'>,
    (params: Record<string, unknown>) => Promise<unknown>
> = {
    overall: params =>
        runOverallAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.timeframe as Timeframe,
            params.modelId as ModelId,
            {
                force: params.force as boolean | undefined,
                reasoning: params.reasoning as boolean | undefined,
            }
        ),

    fundamental: params =>
        runFundamentalAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined
        ),

    financials: params =>
        runFinancialsAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined
        ),

    news: params =>
        submitNewsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined
        ),

    /**
     * newsCard: no client hook or gated action exists yet — calls core directly.
     * Params must include a fully-serialized `NewsItem` and a `thinkingBudget`.
     */
    newsCard: params =>
        runNewsCardAnalysis({
            item: params.item as NewsItem,
            thinkingBudget: params.thinkingBudget as number,
        }),

    marketNewsDigest: params =>
        submitMarketNewsDigestAction(params.category as NewsFeedCategory),

    options: params =>
        submitOptionsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.expirationDate as OptionsExpirationSelector,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined
        ),

    congress: params =>
        runCongressTrendAction(
            params.symbol as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined
        ),

    /**
     * briefing: delegates to the market-summary entity action that owns bot
     * detection and market-summary data loading.
     */
    briefing: _params => submitMarketBriefingAction(),

    macroBriefing: _params => submitMacroBriefingAction(),

    /**
     * economicEvent / indicatorTranslation: server-internal use only (cron, seeding
     * scripts). No gating action exists — core is called directly.
     */
    economicEvent: params =>
        runEconomicEventAnalysis({
            event: params.event as string,
            impact: params.impact as CalendarImpact,
            actual: params.actual as number | null,
            estimate: params.estimate as number | null,
            previous: params.previous as number | null,
            unit: params.unit as string,
        }),

    indicatorTranslation: params =>
        runIndicatorTranslation(params.normalizedName as string),
};

/**
 * Resolves the position bucket for personalized analysis.
 *
 * ponytail: Logic mirrors `runAnalysisAction.resolveHoldingPositionBucket` (private).
 * Cannot extract to `shared/` because FSD prohibits shared from importing entities/portfolio.
 * Refactor both call sites into `entities/analysis/lib/` when `runAnalysis` lands in core
 * and `runAnalysisAction` is updated alongside.
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
 * Browser-side analysis requests MUST go through this SSE route, not server
 * actions. A server action is a single POST — while the server awaits the LLM
 * it sends no bytes, and AWS ALB cuts the idle connection at 60 s (measured on
 * production: 61.1 s without heartbeat, 286 s with 25 s heartbeat). Server-side
 * callers (cron, SSR, bots) are unaffected and may call `run*` directly.
 *
 * Request body: `{ type: AnalysisType; params: <type-specific shape> }`
 *
 * `technical` is handled inline (complex multi-step gating + position-bucket).
 * All other types delegate to their entity action via `DISPATCH`.
 */
export async function POST(request: Request): Promise<Response> {
    // --- 1. Parse and validate request body ---
    let body: StreamRequestBody;
    try {
        body = (await request.json()) as StreamRequestBody;
    } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 });
    }

    // --- 2. Technical analysis: inline gating + personalization ---
    if (body.type === 'technical') {
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
            // --- 2a. Auth ---
            const user = await getCurrentUser();
            const userId = user?.id ?? null;

            // --- 2b. E2E short-circuit (mirrors runAnalysisAction) ---
            if (isE2E()) {
                if (isBot(request.headers)) {
                    return new Response(
                        heartbeatStream(
                            Promise.resolve({
                                status: 'miss_no_trigger' as const,
                            })
                        ),
                        { headers: SSE_HEADERS }
                    );
                }
                const tier = await resolveTierOnly(userId);
                // Dynamic import keeps the E2E stub out of the prod bundle (dead code
                // when E2E_TEST is unset) — same guard as runAnalysisAction.
                const { e2eCachedTechnical } =
                    await import('@/shared/api/e2eAnalysisStub');
                return new Response(
                    heartbeatStream(
                        Promise.resolve({
                            ...e2eCachedTechnical(tier),
                            personalized: false,
                        })
                    ),
                    { headers: SSE_HEADERS }
                );
            }

            // --- 2c. Bot detection → skip enqueue on miss ---
            const skipEnqueueIfMiss = isBot(request.headers);

            // --- 2d. Market profile → assetClass + session-aware data provider ---
            const marketProfile = await resolveMarketProfile(symbol);
            const assetClass = getDescriptor(marketProfile).assetClass;
            const marketDataProvider = getCachedMarketDataProvider(
                sessionSpecFor(marketProfile)
            );

            // --- 2e. Tier + BYOK gate ---
            let tier: 'free' | 'member' | 'pro';
            let userApiKey: string | undefined;

            if (modelId === undefined) {
                tier = await resolveTierOnly(userId);
            } else {
                const gate = await resolveTierAndByok(userId, modelId);
                if (gate.kind === 'blocked') {
                    /**
                     * Stream the gate error as an SSE `error` event so the client
                     * receives the localized message. A 403 HTTP response would cause
                     * `runAnalysisStream` to throw a generic "분석 요청이 실패했습니다 (403)"
                     * instead of the gate-specific message.
                     */
                    return new Response(
                        heartbeatStream(
                            Promise.reject(new Error(gate.error.message))
                        ),
                        { headers: SSE_HEADERS }
                    );
                }
                tier = gate.tier;
                userApiKey = gate.userApiKey;
            }

            // --- 2f. Position bucket for personalized analysis ---
            const positionBucket = await resolveHoldingPositionBucket(
                userId,
                tier,
                symbol,
                fmpSymbol,
                marketDataProvider
            );

            // --- 2g. Build work promise and stream ---
            const options: SubmitAnalysisOptions = {
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

            /**
             * Thread `personalized` alongside the core result so the hook's
             * `setIsPersonalized` gets the server-authoritative value
             * (personalized-analysis-by-position-bucket spec, Subsystem C).
             */
            const work = runAnalysis(
                symbol,
                companyName,
                timeframe,
                force,
                fmpSymbol,
                options
            ).then(result => ({
                ...result,
                personalized: positionBucket !== undefined,
            }));

            return new Response(heartbeatStream(work), {
                headers: SSE_HEADERS,
            });
        } catch (err) {
            console.error('[streamAnalysisRoute] unexpected error:', err);
            return Response.json(
                { status: 'error', error: buildGateError('unexpected_error') },
                { status: 500 }
            );
        }
    }

    // --- 3. Dispatch for non-technical types ---
    const handler = DISPATCH[body.type];
    if (!handler) {
        return Response.json(
            { error: `unsupported analysis type: ${String(body.type)}` },
            { status: 400 }
        );
    }

    try {
        const work = handler(body.params);
        return new Response(heartbeatStream(work), { headers: SSE_HEADERS });
    } catch (err) {
        console.error('[streamAnalysisRoute] unexpected error:', err);
        return Response.json(
            { status: 'error', error: buildGateError('unexpected_error') },
            { status: 500 }
        );
    }
}
