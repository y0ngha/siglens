import type {
    ModelId,
    NewsFeedCategory,
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
import { runAnalysis, type SubmitAnalysisOptions } from './runAnalysisBridge';
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis';
// core에서 직접 import — 해제는 서버 전용이어야 한다(클라이언트가 호출할 수 있으면
// 쿨다운을 지우고 재요청하는 루프로 무력화된다). 아래 `releaseOnFailure` 참고.
import { releaseReanalyzeCooldown } from '@y0ngha/siglens-core';

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
    | 'marketNewsDigest'
    | 'options'
    | 'congress'
    | 'briefing'
    | 'macroBriefing';

type TechnicalParams = {
    symbol: string;
    companyName: string;
    timeframe: Timeframe;
    fmpSymbol?: string;
    modelId?: ModelId;
    /**
     * Client-requested deep-thinking toggle. Honored only for member/pro tiers —
     * `resolveReasoning` forces `false` for anonymous/free callers regardless.
     */
    reasoning?: boolean;
    /**
     * 사용자가 "재분석"을 누른 요청이라는 **의도** 표시. 캐시 우회(`force`) 자체가
     * 아니다 — 실제 우회 여부는 서버가 재분석 쿨다운을 획득했는지로 정한다.
     * 그래서 이 값을 믿어도 (symbol, timeframe)당 5분에 한 번 이상 LLM을 태울 수 없다.
     */
    reanalyze?: boolean;
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
 * Stream duration upper bound: if the LLM round-trip exceeds 5 minutes the
 * server emits an error event and closes the stream. This guards against
 * runaway LLM calls that would otherwise hold an open SSE connection
 * indefinitely and consume a Node worker slot.
 *
 * ponytail: single shared timeout, not per-request. Acceptable because all
 * in-flight analysis calls use the same model-tier cap. Reduce to 3 min if
 * pro-tier fast models make 5 min feel long.
 */
const STREAM_DEADLINE_MS = 5 * 60 * 1_000;

/**
 * 포지션 버킷 파생용 시세 조회 상한. 이 조회는 첫 SSE 바이트 이전에 일어나 heartbeat의
 * 보호를 받지 못하므로, ALB idle_timeout(60초)보다 훨씬 짧게 잡는다.
 */
const QUOTE_LOOKUP_TIMEOUT_MS = 5_000;

/**
 * ⚠️ `request.signal`을 core `run*`에 **의도적으로 전달하지 않는다.** 누락이 아니다.
 *
 * core의 분석 실행은 `dedupeInFlight(cacheKey, …)`로 공유된다 — 같은 캐시 키의 모든
 * 호출자가 **하나의 promise**를 함께 기다린다. 여기에 특정 클라이언트의 signal을
 * 꽂으면 그 한 명이 탭을 닫는 순간 공유 promise가 reject되고, 같은 심볼을 기다리던
 * SEO prewarm 크론까지 실패한다(그 유닛은 6시간 backoff로 밀린다).
 *
 * 게다가 캐시 write는 `await callAnalysisAi` **뒤에** 있다. abort하면 캐시가 비므로,
 * 방문자가 이탈할 때마다 캐시 워밍이 통째로 사라진다 — 구 worker 구조에서는 브라우저와
 * 무관하게 job이 완주해 항상 캐시를 채웠다.
 *
 * 즉 이탈한 방문자의 LLM 호출은 낭비가 아니라 **다음 방문자와 크롤러를 위한 선투자**다.
 * 취소가 필요하다면 먼저 core의 `dedupeInFlight`에 참조 카운팅을 넣어 마지막 대기자가
 * 떠날 때만 abort되게 해야 한다. 그 전에는 여기서 signal을 넘기면 안 된다.
 *
 * 대신 폭주 방지는 `withDeadline`(5분)이 담당한다 — 클라이언트 유무와 무관한 상한이다.
 */

/**
 * `run(signal)`을 고정 마감과 경주시킨다. 마감을 넘기면 localized 메시지로 reject해
 * `heartbeatStream`이 SSE `error` 이벤트를 내보내고 연결을 닫는다.
 *
 * 마감이 **자체 `AbortController`로 작업을 실제 취소**하는 게 핵심이다. 취소하지 않으면
 * 스트림만 닫히고 core의 호출은 provider 타임아웃(어댑터 기본 1시간)까지 계속 살아 있다.
 * 그 promise는 `dedupeInFlight` Map에 남으므로, 같은 캐시 키의 이후 요청이 전부 죽은
 * promise에 합류해 5분씩 기다렸다 실패한다 — 한 번의 provider 행이 그 키를 최대 한 시간
 * 봉인한다.
 *
 * 이 signal은 클라이언트별이 아니라 **작업별**이라, 위에서 설명한 공유 abort 문제가 없다:
 * 누가 듣고 있든 5분이 지나면 그 작업 자체가 가망이 없다.
 */
function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(
                new Error('분석 시간이 초과되었습니다. 다시 시도해 주세요.')
            );
        }, STREAM_DEADLINE_MS);
    });
    // work가 먼저 끝나면 타이머를 즉시 회수한다 — 없으면 매 요청이 5분짜리 타이머와
    // 그 reject 클로저를 붙들고 있어, LLM 작업까지 떠안은 인스턴스에서 그대로 누적된다.
    // run()이 **동기적으로** throw할 수 있다(핸들러가 params를 즉시 구조분해하는 경우).
    // 그대로 두면 Promise.race가 구성되지 않아 아래 finally가 붙지 않고, 타이머가
    // 살아남아 5분 뒤 아무도 듣지 않는 deadline이 reject된다(unhandled rejection).
    const started = (async () => run(controller.signal))();
    return Promise.race([started, deadline]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
    });
}

/**
 * Dispatch table: maps each non-technical analysis type to a function that
 * receives the raw `params` bag and an optional `AbortSignal`, and returns a
 * Promise. The returned promise is piped into `heartbeatStream`, keeping the
 * browser SSE connection alive for the full LLM round-trip. Each entry
 * delegates to the entity action that already owns auth, tier/BYOK gating,
 * E2E short-circuit, bot detection, and data-fetch — no logic is duplicated
 * here. The `signal` each entry receives is the **deadline** controller owned by
 * `withDeadline` — never the client's `request.signal`. See the long comment above
 * `withDeadline` for why threading a per-client signal into core is forbidden.
 */
const DISPATCH: Record<
    Exclude<AnalysisType, 'technical'>,
    (
        params: Record<string, unknown>,
        signal: AbortSignal | undefined
    ) => Promise<unknown>
> = {
    overall: async (params, signal) => {
        // technical과 같은 규칙 — 클라이언트는 의도만 보내고, 캐시 우회 여부는
        // 서버가 쿨다운 획득으로 판단한다. 키 namespace를 분리해(`<tf>:overall`)
        // 기술적 분석 재분석이 종합 분석 재분석을 막지 않게 한다.
        const cooldown =
            params.reanalyze === true
                ? await tryAcquireReanalyzeCooldown(
                      params.symbol as string,
                      `${params.timeframe as Timeframe}:overall` as Timeframe
                  )
                : null;
        if (cooldown !== null && !cooldown.ok) {
            return {
                status: 'reanalyze_cooldown' as const,
                remainingMs: cooldown.remainingMs,
            };
        }
        return runOverallAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.timeframe as Timeframe,
            params.modelId as ModelId,
            {
                force: cooldown?.ok === true,
                reasoning: params.reasoning as boolean | undefined,
            },
            signal
        );
    },

    fundamental: (params, signal) =>
        runFundamentalAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined,
            signal
        ),

    financials: (params, signal) =>
        runFinancialsAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined,
            signal
        ),

    news: (params, signal) =>
        submitNewsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined,
            signal
        ),

    marketNewsDigest: (params, signal) =>
        submitMarketNewsDigestAction(
            params.category as NewsFeedCategory,
            signal
        ),

    options: (params, signal) =>
        submitOptionsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.expirationDate as OptionsExpirationSelector,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined,
            signal
        ),

    congress: (params, signal) =>
        runCongressTrendAction(
            params.symbol as string,
            params.modelId as ModelId,
            params.reasoning as boolean | undefined,
            signal
        ),

    /**
     * briefing: delegates to the market-summary entity action that owns bot
     * detection and market-summary data loading.
     */
    briefing: (_params, signal) => submitMarketBriefingAction(signal),

    macroBriefing: (_params, signal) => submitMacroBriefingAction(signal),
};

/*
 * 의도적으로 여기 없는 것: `newsCard` / `economicEvent` / `indicatorTranslation`.
 *
 * 이 셋은 게이팅 액션이 없어 core를 직접 호출해야 하는데, 이 라우트는 인증 없는
 * 공개 POST다(`proxy.ts`가 `/api`를 미들웨어 매처에서 제외). 브라우저 호출자도
 * 없으므로 노출할 이유가 없고, 노출하면 익명 루프가 서버 키로 LLM 비용을 태우는
 * 경로가 된다 — 특히 `newsCard`는 요청 본문의 `NewsItem`이 그대로 프롬프트에 들어간다.
 *
 * 서버 내부(크론·시딩)는 브라우저 연결이 없으므로 SSE가 필요 없고, core `run*`을
 * 직접 `await`하면 된다. 나중에 브라우저에서 이 셋이 필요해지면 먼저 게이팅 액션을
 * 만들고 그 액션을 여기에 등록할 것.
 */

/**
 * Resolves the position bucket for personalized analysis.
 *
 * ponytail: Cannot extract to `shared/` because FSD prohibits shared from importing
 * entities/portfolio. Refactor into `entities/analysis/lib/` if a second call site appears.
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
        /**
         * 이 조회는 **첫 SSE 바이트가 나가기 전**에 일어난다 — heartbeat가 아직 시작되지
         * 않았으므로 여기서 오래 끌면 ALB idle_timeout(60초)이 연결을 끊는다. FMP 429
         * 폭풍에서는 요청 타임아웃 10초 + 백오프 10/15/20초로 한 번의 getQuote가 85초까지
         * 갈 수 있다. 개인화는 있으면 좋은 것이지 분석의 전제가 아니므로, 짧은 상한을
         * 두고 넘기면 버킷 없이 진행한다.
         */
        const quote = await Promise.race([
            marketDataProvider.getQuote(fmpSymbol ?? symbol),
            new Promise<null>(resolve => {
                setTimeout(
                    () => resolve(null),
                    QUOTE_LOOKUP_TIMEOUT_MS
                ).unref();
            }),
        ]);
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
        // `params` 자체가 없을 수 있다(`{"type":"technical"}`). 구조분해를 try 밖에
        // 두면 그 입력이 처리되지 않은 throw로 500이 된다 — 400이어야 한다.
        if (body.params == null || typeof body.params !== 'object') {
            return Response.json(
                { error: 'technical requires a params object' },
                { status: 400 }
            );
        }

        const {
            symbol,
            companyName,
            timeframe,
            fmpSymbol,
            modelId,
            reasoning,
            reanalyze,
        } = body.params;

        try {
            // --- 2a. Auth ---
            const user = await getCurrentUser();
            const userId = user?.id ?? null;

            // --- 2b. E2E short-circuit ---
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
                // when E2E_TEST is unset).
                const { e2eCachedTechnical } =
                    await import('@/shared/api/e2eAnalysisStub');
                // E2E 스텁은 버킷이 계산되기 **전에** fixture를 돌려주므로
                // (`runAnalysis`/`resolveHoldingPositionBucket`이 이 분기에선
                // 아예 돌지 않는다) `personalized`를 평소처럼 파생할 수 없다.
                // 배지 배선을 E2E에서 검증 가능하게 유지하되 거짓말은 하지
                // 않도록, `resolveHoldingPositionBucket`과 같은 조건(free가
                // 아니고 홀딩이 존재)으로 근사한다 — fixture가 어차피 실제
                // 버킷/시세를 반영하지 않으니 그 해석은 E2E에서 무의미하다.
                let personalized = false;
                if (tier !== 'free' && userId !== null) {
                    try {
                        const { db } = getDatabaseClient();
                        const holding = await new DrizzlePortfolioRepository(
                            db
                        ).findByUserAndSymbol(userId, symbol.toUpperCase());
                        personalized = holding !== null;
                    } catch (error) {
                        console.error(
                            '[streamAnalysisRoute] E2E personalized-flag holding read failed, degrading to false:',
                            error
                        );
                        personalized = false;
                    }
                }
                return new Response(
                    heartbeatStream(
                        Promise.resolve({
                            ...e2eCachedTechnical(tier),
                            personalized,
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
            };

            /**
             * Thread `personalized` alongside the core result so the hook's
             * `setIsPersonalized` gets the server-authoritative value
             * (personalized-analysis-by-position-bucket spec, Subsystem C).
             */
            /**
             * `force`(캐시 우회)는 **클라이언트가 정하지 않는다.** 이 라우트는 인증 없는
             * 공개 POST이므로, 본문의 `force:true`를 그대로 믿으면 누구나 캐시를
             * 건너뛰고 매 요청마다 서버 키로 LLM을 태울 수 있다.
             *
             * 클라이언트가 보내는 건 **의도**(`reanalyze`)뿐이고, 실제 우회 여부는
             * 서버가 재분석 쿨다운(Redis `SET NX EX 300`)을 획득했는지로 판단한다.
             * 정상 경로에서 (symbol, timeframe)당 5분에 한 번으로 제한된다.
             *
             * 보장의 한계를 분명히 해 둔다 — 이건 **비용 상한이지 보안 경계가 아니다**:
             * `tryAcquireReanalyzeCooldown`은 Redis 장애 시 fail-open(`{ok:true}`)이라
             * Upstash가 죽으면 모든 reanalyze 요청이 force가 된다. 반대로 fail-closed로
             * 두면 Redis 장애가 재분석 기능 전체를 막는다. 진짜 상한이 필요해지면
             * 여기가 아니라 요청 단위 rate limit(IP/세션)으로 올려야 한다.
             *
             * 획득은 **여기서만** 한다. 클라이언트가 미리 획득한 뒤 요청을 보내면
             * 여기서의 획득이 반드시 실패해 재분석이 영원히 캐시로 강등되고, 반대로
             * 의도 없는 일반 제출이 획득에 성공해 캐시를 우회하는 정반대 동작이 된다.
             */
            const wantsReanalyze = reanalyze === true;
            const cooldown = wantsReanalyze
                ? await tryAcquireReanalyzeCooldown(symbol, timeframe)
                : null;

            if (cooldown !== null && !cooldown.ok) {
                // 쿨다운 중 — 새 분석을 태우지 않고 남은 시간을 알려준다.
                return new Response(
                    heartbeatStream(
                        Promise.resolve({
                            status: 'reanalyze_cooldown' as const,
                            remainingMs: cooldown.remainingMs,
                        })
                    ),
                    { headers: SSE_HEADERS }
                );
            }

            const force = cooldown?.ok === true;

            /**
             * 분석이 실패하면 획득했던 쿨다운을 **서버가** 되돌린다. 안 되돌리면 사용자는
             * 아무 결과도 못 받은 채 5분을 기다려야 한다.
             *
             * 해제를 클라이언트에 맡기지 않는 이유: 그러려면 인증 없는 공개 서버 액션으로
             * 열어야 하는데, 그 순간 "해제 → 재요청"을 반복해 쿨다운 자체를 무력화할 수
             * 있다 — 이 쿨다운이 공개 라우트에서 캐시 우회 LLM 호출을 막는 유일한 장치다.
             * 또 클라이언트 쪽 실패(탭 이동으로 인한 fetch abort 등)는 서버 작업이 여전히
             * 살아 있는 상태라 해제 대상이 아니다.
             */
            const releaseOnFailure = async (): Promise<void> => {
                if (!force) return;
                try {
                    await releaseReanalyzeCooldown(symbol, timeframe);
                } catch (err) {
                    console.error(
                        '[streamAnalysisRoute] cooldown release failed:',
                        err
                    );
                }
            };

            const work = withDeadline(deadlineSignal =>
                runAnalysis(symbol, companyName, timeframe, force, fmpSymbol, {
                    ...options,
                    signal: deadlineSignal,
                }).then(result => ({
                    ...result,
                    personalized: positionBucket !== undefined,
                }))
            ).catch(async (err: unknown) => {
                await releaseOnFailure();
                throw err;
            });

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
    // Object.hasOwn: `body.type`이 'toString' 같은 프로토타입 멤버면 인덱싱이
    // 상속된 함수를 반환해 `!handler` 가드를 통과한다 — 400이어야 할 입력이 500이 된다.
    // technical과 동일한 가드를 나머지 타입에도 적용한다 — 핸들러가 params를 즉시
    // 구조분해하므로, 없으면 TypeError가 500으로 새어 나간다(400이어야 한다).
    if (body.params == null || typeof body.params !== 'object') {
        return Response.json(
            { error: 'params must be an object' },
            { status: 400 }
        );
    }

    const handler = Object.hasOwn(DISPATCH, body.type)
        ? DISPATCH[body.type]
        : undefined;
    if (!handler) {
        return Response.json(
            { error: `unsupported analysis type: ${String(body.type)}` },
            { status: 400 }
        );
    }

    try {
        const work = withDeadline(deadlineSignal =>
            handler(body.params, deadlineSignal)
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
