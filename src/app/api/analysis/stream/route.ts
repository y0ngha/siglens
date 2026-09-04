import type {
    AssembledPromptRecord,
    ModelId,
    PositionBucket,
    Timeframe,
} from '@y0ngha/siglens-core';
import { after } from 'next/server';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import { getTranslations } from 'next-intl/server';
import type { AnalysisGateErrorCode } from '@/shared/lib/types';
import {
    ANALYSIS_LOCALE_HEADER,
    DEFAULT_LOCALE,
    isLocale,
    type Locale,
} from '@/shared/i18n/locales';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { isBot } from '@/shared/api/isBot';
import {
    resolveCurrentPrice,
    rewriteToPlainLanguage,
} from '@/entities/analysis-plain';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    currencyForSymbol,
    getDescriptor,
} from '@/shared/config/marketProfile';
import type { NewsFeedCategoryId } from '@/entities/market-news';
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
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { runAnalysis, type SubmitAnalysisOptions } from './runAnalysisBridge';
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis';
import {
    DrizzleAnalysisHistoryRepository,
    resolveGeneratedAt,
    type AnalysisHistoryTab,
} from '@/entities/analysis/analysisHistoryRepository';
// core에서 직접 import — 해제는 서버 전용이어야 한다(클라이언트가 호출할 수 있으면
// 쿨다운을 지우고 재요청하는 루프로 무력화된다). 아래 `releaseOnFailure` 참고.
import { releaseReanalyzeCooldown } from '@y0ngha/siglens-core';

// Actions: gating + data-fetch already live in each entity's action file.
// Calling them from the route (server-side) is safe — no browser connection means
// no idle-connection wall at all. The SSE heartbeat stream keeps the browser
// connection alive while these actions await the LLM.
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
    //
    // ⚠️ 이 지시어는 이제 **오리진 자신에게도** 걸린다. `next.config.ts`가
    // `compress: true`라 Next의 압축 미들웨어가 응답에 붙는데, 그 미들웨어는
    // `no-transform`을 보면 빠진다. 이 한 조각을 빼면 SSE가 gzip 스트림에 들어가
    // 청크가 버퍼링되고 실시간성이 사라진다 — CF 설정을 정리하다 무심코 지우기
    // 쉬운 자리라 명시해 둔다.
    'Cache-Control': 'no-cache, no-store, no-transform',
    // Disables nginx-family proxy response buffering. Kept after the 2026-08
    // cloudflared migration: cloudflared does not buffer `text/event-stream`
    // (verified — 600s probe arrived at exact 25.0s gaps), but this header costs
    // nothing and still applies to any intermediary.
    'X-Accel-Buffering': 'no',
};

/**
 * Stream duration upper bound: if the LLM round-trip exceeds this, the server
 * emits an error event and closes the stream. This guards against runaway LLM
 * calls that would otherwise hold an open SSE connection indefinitely and
 * consume a Node worker slot.
 *
 * **Why 10 minutes.** 5 minutes was measurably too tight for the premium models.
 * On 2026-08-09 a `deepseek-v4-pro` call on PLTR (promptTokens 29k) returned in
 * 248.5s — 52s of headroom — and the next request on the same key was cut at the
 * 300s mark. The ceiling has to clear the slowest legitimate call, not sit beside it.
 *
 * 10 minutes is measured, not assumed. `/api/sse-probe` at `duration=600&interval=25`
 * completed twice through production (601.4s / 601.2s, CF PoPs LAX and SJC) with
 * constant sub-second drift and 24.9–25.3s arrival gaps — no edge buffering. The
 * control run with a 90s silence gap was severed at exactly 61.0s — that was the ALB
 * idle timeout. After the 2026-08 cloudflared migration the same control was re-measured
 * through the tunnel and severed at **125.9s** (Cloudflare Proxy Read Timeout), and the
 * 600s heartbeat run completed with exact 25.0s gaps. So the wall doubled but
 * `HEARTBEAT_INTERVAL_MS` (25s) is still what clears it. Raising this bound past ~10 min
 * would need a fresh measurement.
 *
 * **Deliberately NOT matched to the shutdown drain** (`SHUTDOWN_DRAIN_DEADLINE_MS`,
 * 180s). Aligning them would mean raising the drain budget from ~180s to 605s — and
 * cloudflared caps `TUNNEL_GRACE_PERIOD` at 180s, so it is not even expressible —
 * which adds ~7 minutes per instance replacement and pushes a two-instance roll from
 * ~18 min to ~30 min. What that buys is "an in-flight analysis survives a deploy" —
 * and deploys are a handful per week against ~19 LLM calls per day. The 180s < deadline
 * gap already existed at 5 minutes and has produced no observed failure; widening it
 * adds no new failure mode, only slightly more exposure to an existing one.
 *
 * ponytail: single shared timeout, not per-request. Acceptable because all
 * in-flight analysis calls use the same model-tier cap.
 */
const STREAM_DEADLINE_MS = 10 * 60 * 1_000;

/**
 * 포지션 버킷 파생용 시세 조회 상한. 이 조회는 첫 SSE 바이트 이전에 일어나 heartbeat의
 * 보호를 받지 못하므로, 침묵 벽(cloudflared 경유 실측 125.9초)보다 훨씬 짧게 잡는다.
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
function withDeadline<T>(
    run: (signal: AbortSignal) => Promise<T>,
    timeoutMessage: string
): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new LocalizedStreamError(timeoutMessage));
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
 * `runAnalysis`(technical)가 `modelId` 생략 시 내부적으로 폴백하는 값과
 * 동일하다(`entities/analysis/api.ts` 상단 주석 참고). 캐시 키와는 무관 —
 * 오직 이 라우트가 히스토리 행의 `model_id`(감사용 컬럼)에 무엇을 적을지
 * 결정하는 용도라, 여기가 core 상수와 어긋나도 캐시 동작에는 영향이 없다.
 */
const DEFAULT_TECHNICAL_MODEL_ID = 'analysis-worker';

/**
 * Task S2 (prior-analysis-context) — 새로 생성된 technical/overall 분석 1건을
 * `analysis_history`에 최선노력으로 기록한다.
 *
 * **`after()`로 스케줄한다.** 응답은 이미 SSE로 클라이언트에 나간 뒤이므로,
 * 여기서 대기해도 사용자 체감 지연이 없다(비교: `onPromptAssembled`은 프로바이더
 * 호출 직전에 동기 캡처만 하고 절대 await하지 않는다 — 그건 응답 전 경로다).
 *
 * `DrizzleAnalysisHistoryRepository.saveAnalysisHistory`는 절대 throw하지
 * 않는다(내부에서 catch+log) — 이 함수도 마찬가지로 실패를 삼킨다.
 */
function schedulePersistAnalysisHistory(input: {
    symbol: string;
    timeframe: string;
    tab: AnalysisHistoryTab;
    modelId: string;
    locale: Locale;
    result: unknown;
    /**
     * 캐시 미스 승자만 이 값을 받는다 — 동시 요청의 패자는 `undefined`다.
     * `undefined`는 정상 경로이지 실패가 아니다(core 계약, 이 파일 상단
     * import 주석 및 `AssembledPromptRecord` JSDoc 참고). 그대로 repository에
     * 넘겨 프롬프트 컬럼이 null인 행을 남긴다.
     */
    prompt: AssembledPromptRecord | undefined;
}): void {
    // Prefer the analysis's OWN generation timestamp over the moment we happen
    // to schedule the write. The technical axis stamps `analyzedAt` into its
    // result; the overall axis does not, so it falls back to now. This matters
    // downstream: the prior-analysis window anchors each past call to the BAR
    // it belongs to, and a row stamped late enough to cross a bar boundary
    // would be attributed to the wrong bar.
    const generatedAt = resolveGeneratedAt(input.result);
    try {
        // `after()` itself (not just its callback) can throw synchronously
        // — e.g. called outside a request scope. The DISPATCH `overall`
        // call site invokes this function inline (no surrounding
        // `.then()`/`.catch()`), so a bare `after()` throw here would
        // reject that whole handler and turn an already-successful
        // analysis into a client-visible error. Persistence must never do
        // that — swallow and log instead.
        after(async () => {
            const { db } = getDatabaseClient();
            await new DrizzleAnalysisHistoryRepository(db).saveAnalysisHistory({
                symbol: input.symbol,
                timeframe: input.timeframe,
                tab: input.tab,
                modelId: input.modelId,
                locale: input.locale,
                result: input.result,
                generatedAt,
                prompt: input.prompt,
            });
        });
    } catch (err) {
        console.error(
            '[streamAnalysisRoute] schedulePersistAnalysisHistory failed:',
            err
        );
    }
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
/**
 * ⚠️ `locale`은 **반드시 여기로 흘러야 한다.** 액션이 돌려주는 게이트 오류
 * (`{ status: 'error', error: { code, message } }`)는 훅이 그대로 화면에 던지는
 * 사용자 문구인데, `/api/*`는 next-intl matcher에서 제외돼 있어 액션이 스스로
 * 로케일을 알아낼 방법이 없다(`byokGate.ts`의 `gateMessage` JSDoc 참고).
 */
const DISPATCH: Record<
    Exclude<AnalysisType, 'technical'>,
    (
        params: Record<string, unknown>,
        signal: AbortSignal | undefined,
        locale: Locale,
        /**
         * Task S3 (prior-analysis-context) — only `overall` reads it (to
         * skip the history query for bot requests, mirroring the technical
         * branch's `skipEnqueueIfMiss` gate). The other entries ignore the
         * extra argument; TS structurally allows an implementation with
         * fewer parameters than the declared function type.
         */
        isBotRequest: boolean
    ) => Promise<unknown>
> = {
    overall: async (params, signal, locale, isBotRequest) => {
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

        const symbol = params.symbol as string;
        const timeframe = params.timeframe as Timeframe;
        const modelId = params.modelId as ModelId;

        // core의 `onPromptAssembled`는 캐시 미스에서 정확히 한 번, 프로바이더
        // 호출 직전에 **동기로** 캡처만 한다 — 여기서 await하지 않는다(Task S2
        // 계약, `schedulePersistAnalysisHistory` 주석 참고).
        let capturedPrompt: AssembledPromptRecord | undefined;

        // Task S3 (prior-analysis-context) — read history BEFORE the core
        // call, unconditionally on the non-bot path. core folds a
        // fingerprint of `priorAnalyses` into the cache key, so a lazy
        // read-on-miss would let the key computation and the prompt
        // rendering see different history sets for the same request. This
        // costs one indexed query per non-bot request; accepted, not
        // deferred. `isBotRequest` (passed in from `POST`'s dispatch call
        // site, same `isBot(request.headers)` value the concurrency cap
        // uses) skips the query entirely for a request that will not
        // trigger a generation — `runOverallAnalysisAction` independently
        // derives its own `skipEnqueueIfMiss` for the same reason.
        const priorAnalyses = isBotRequest
            ? undefined
            : await new DrizzleAnalysisHistoryRepository(
                  getDatabaseClient().db
              ).findRecentForPrompt({ symbol, timeframe, tab: 'overall' });

        const result = await runOverallAnalysisAction(
            symbol,
            params.companyName as string,
            timeframe,
            modelId,
            locale,
            {
                force: cooldown?.ok === true,
                reasoning: params.reasoning as boolean | undefined,
                onPromptAssembled: record => {
                    capturedPrompt = record;
                },
                priorAnalyses,
            },
            signal
        ).catch(async (err: unknown) => {
            // technical 분기의 `releaseOnFailure`와 같은 이유 — 실패하면 획득한
            // 쿨다운을 되돌린다. 안 되돌리면 사용자는 결과도 못 받은 채 5분간
            // 재분석이 막힌다.
            if (cooldown?.ok === true) {
                try {
                    await releaseReanalyzeCooldown(
                        symbol,
                        `${timeframe}:overall` as Timeframe
                    );
                } catch (releaseErr) {
                    console.error(
                        '[streamAnalysisRoute] overall cooldown release failed:',
                        releaseErr
                    );
                }
            }
            throw err;
        });

        // 'cached'는 이미 존재하는 행을 가리키므로 다시 저장하지 않는다 —
        // 새로 생성된('done') 결과만 히스토리에 남긴다.
        //
        // `modelId`에 기본값 폴백을 두지 않는다 — technical과 달리 overall은
        // core가 캐시 키에 modelId를 그대로 쓰므로(`entities/analysis/api.ts`
        // 상단 주석) 생략은 정상 입력이 아니다. 누락되면 저장을 건너뛴다.
        if (result.status === 'done' && modelId !== undefined) {
            schedulePersistAnalysisHistory({
                symbol,
                timeframe,
                tab: 'overall',
                modelId,
                locale,
                result: result.result,
                prompt: capturedPrompt,
            });
        }

        return result;
    },

    fundamental: (params, signal, locale) =>
        runFundamentalAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal
        ),

    financials: (params, signal, locale) =>
        runFinancialsAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal
        ),

    news: (params, signal, locale) =>
        submitNewsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal
        ),

    marketNewsDigest: (params, signal, locale) =>
        submitMarketNewsDigestAction(
            params.category as NewsFeedCategoryId,
            locale,
            signal
        ),

    options: (params, signal, locale) =>
        submitOptionsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.expirationDate as OptionsExpirationSelector,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            params.cacheOnly as boolean | undefined
        ),

    congress: (params, signal, locale) =>
        runCongressTrendAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal
        ),

    /**
     * briefing: delegates to the market-summary entity action that owns bot
     * detection and market-summary data loading.
     */
    briefing: (params, signal) =>
        // scope는 클라이언트가 보낸 문자열이다. 여기서 좁히지 않고 그대로 넘기는 것은
        // 의도된 설계다 — 액션이 `isDashboardScopeId`로 검증하고 알 수 없는 값이면
        // 에러를 돌려준다(라우트와 액션 양쪽에 검증을 두면 규칙이 갈린다).
        submitMarketBriefingAction(params.scope as string, signal),

    // 게이트를 쓰지 않아 사용자 문구를 만들지 않는다 — 로케일이 필요 없다.
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
         * 않았으므로 여기서 오래 끌면 침묵 벽(실측 125.9초)이 연결을 끊는다. FMP 429
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
 * it sends no bytes, and the edge cuts the idle connection (measured on production:
 * 61.1 s through the ALB, 125.9 s through cloudflared after the 2026-08 migration;
 * 600 s completes cleanly with the 25 s heartbeat). Server-side callers (cron, SSR,
 * bots) are unaffected and may call `run*` directly.
 *
 * Request body: `{ type: AnalysisType; params: <type-specific shape> }`
 *
 * `technical` is handled inline (complex multi-step gating + position-bucket).
 * All other types delegate to their entity action via `DISPATCH`.
 */
/**
 * 요청이 실은 로케일. 없거나 알 수 없는 값이면 기본 로케일.
 *
 * `/api/*`는 next-intl 미들웨어 matcher에서 제외돼 있어 요청 로케일을 알 방법이
 * 헤더뿐이다(`useAnalysisStream`이 주소에서 유도해 싣는다). 신뢰 경계이므로
 * 반드시 `isLocale`로 검증한다 — 임의 문자열이 캐시 키에 들어가면 번역 캐시가
 * 무한히 파편화된다.
 */
function resolveRequestLocale(request: Request): Locale {
    const raw = request.headers.get(ANALYSIS_LOCALE_HEADER) ?? '';
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * 사용자 화면에 그대로 렌더되는 에러 문구.
 *
 * `heartbeatStream`이 거절을 SSE `error` 이벤트의 `{ message }`로 실어 보내고,
 * `useAnalysisStream` → `useAnalysis` → `ChartContent`의 `<ErrorBanner>`가 그걸
 * 그대로 띄운다. 즉 **서버 로그 문구가 아니라 UI 카피**다.
 *
 * `scripts/i18n/lib/scan.mjs`는 `src/app/api/`를 "사용자에게 렌더되지 않는다"는
 * 전제로 제외하는데, 이 세 문구에 대해서는 그 전제가 틀렸다 — 그래서 기준선
 * 1,671건에도 잡히지 않았다. 카탈로그(`app.api.stream`)로 옮기고
 * `noRawUserFacingApiStrings` 테스트가 재발을 막는다.
 */
async function streamMessages(locale: Locale) {
    return getTranslations({ locale, namespace: 'app.api.stream' });
}

/**
 * BYOK/tier 게이트 문구를 로케일에 맞게 만든다.
 *
 * `buildGateError`는 `shared/lib/byokGate.ts`의 한국어 리터럴을 담아 돌려주는데,
 * 그게 SSE `error` 이벤트와 `Response.json`을 통해 그대로 화면에 뜬다. 코드
 * (`tier_premium_blocked` 등)가 실질적인 단일 출처이므로 여기서 코드로 번역한다.
 * 원본 `message`는 서버 로그용으로 남는다.
 */
async function gateMessage(
    locale: Locale,
    code: AnalysisGateErrorCode
): Promise<string> {
    const t = await getTranslations({
        locale,
        namespace: 'shared.lib.byokGate',
    });
    return t(code);
}

/**
 * 평이화("쉽게보기")를 적용할 분석 종류.
 *
 * 토글 UI가 있는 종목 탭 7종만. `briefing`·`macroBriefing`·`marketNewsDigest`는
 * 화면에 토글이 없어 호출이 그대로 낭비다.
 *
 * `extractProse`와 평이화 프롬프트 어느 쪽에도 타입별 분기가 없으므로, 종류를
 * 늘리는 비용은 이 집합에 문자열 하나를 넣는 것이다.
 */
const PLAIN_ENABLED_TYPES: ReadonlySet<AnalysisType> = new Set([
    'technical',
    'overall',
    'news',
    'fundamental',
    'financials',
    'options',
    'congress',
]);

/**
 * core가 만든 게이트 거부 문구를 요청 로케일 카탈로그로 갈아끼운다.
 *
 * `timeframe_not_allowed`의 `message`는 core가 만든 **영어** 문장이라 ko
 * 사용자에게도 영어가 나갔다. 코드가 함께 오므로 문구만 대체한다.
 *
 * 사라진 사후 번역 계층 안에 얹혀 있던 동작이다. 그 계층은 LLM 번역이었지만
 * 이것은 카탈로그 조회라 성격이 다르고, 함께 지우면 게이트 거부 배너가 다시
 * 영어로 돌아간다 — 계층을 걷어낼 때 이 부분만 남긴 이유다.
 */
async function withLocalizedGateError<T>(
    work: Promise<T>,
    locale: Locale
): Promise<T> {
    const result = await work;
    if (
        typeof result !== 'object' ||
        result === null ||
        (result as { status?: unknown }).status !== 'error'
    ) {
        return result;
    }
    const envelope = result as { error?: { code?: string; message?: string } };
    if (envelope.error?.code !== 'timeframe_not_allowed') return result;

    const t = await getTranslations({ locale, namespace: 'app.api.stream' });
    return {
        ...envelope,
        error: { ...envelope.error, message: t('timeframeNotAllowed') },
    } as T;
}

/** SSE 응답 봉투에 붙는 평이화 필드. core 타입은 건드리지 않는다. */
type WithPlain<T> = T & { plain?: string | null };

/**
 * 결과 봉투에 평이화 산문을 덧붙인다.
 *
 * ## 입력은 이미 요청 로케일이다
 *
 * 여덟 축 전부 core에 `locale`을 넘기므로, 이 함수가 받는 `result`의 산문은
 * 이미 요청 언어로 쓰여 있다. 평이화는 그것을 쉽게 고쳐 쓰기만 하면 된다.
 *
 * 그래서 사후 번역 계층(`withLocalizedProse` → `translateAnalysisForLocale`)이
 * 이 커밋에서 사라졌다. 그 계층은 여덟 축 **전부**에 걸려 있었는데, 일곱 축은
 * 이미 core가 대상 언어로 써준 산출물을 "한국어를 번역하라" 프롬프트에 다시
 * 넣고 있었다(라우트 주석은 "일곱 축은 사후 번역을 타지 않는다"고 적어 두었지만
 * 사실이 아니었다). 그 파손이 드러나지 않은 이유는 번역기 자체가 죽어 있었기
 * 때문이다 — Gemini 설정(`GEMINI_API_KEY` + `gemini-2.5-flash-lite`)을 읽어
 * `callDeepseekChat`에 넘겨 `Non-DeepSeek model spec`으로 던지고, 그 예외를
 * 삼킨 뒤 원문을 그대로 돌려주고 있었다.
 *
 * ## 왜 순서가 중요한가
 *
 * 평이화 산출물의 언어는 지시가 아니라 **입력 산문의 언어**가 지배한다.
 * 프로덕션 프롬프트·프로바이더로 측정한 결과(N=6, 재시도 포함):
 *
 *   한국어 산문 + "일본어로 쓰라" → 일본어 4/6
 *   한국어 산문 + "중국어로 쓰라" → 중국어 2/6
 *
 * 지시를 시스템 프롬프트·머리말·말미 세 곳에 대상 언어로 넣고도 이 정도였다.
 * 산문을 먼저 옮겨 넣으면 중국어가 4/4로 올랐다. core가 네이티브로 써주는 지금
 * 구조에서는 이 문제가 애초에 생기지 않는다.
 *
 * ## 에러 봉투에는 붙이지 않는다
 *
 * 액션은 실패를 `{ status: 'error', ... }`로 돌려주는데, 그 안의 `message`가
 * `PROSE_FIELD_NAMES`에 걸려 산문으로 추출된다. 그대로 두면 게이트 거부 문구를
 * LLM에 보내 "쉽게 쓴 에러 메시지"를 만들고, 거부마다 DeepSeek 왕복이 붙는다
 * (지금은 사라진 사후 번역 계층이 같은 함정을 이미 겪은 자리다).
 */

async function withPlainLanguage<T>(
    result: T,
    symbol: string,
    locale: Locale
): Promise<WithPlain<T>> {
    if (
        typeof result !== 'object' ||
        result === null ||
        (result as { status?: unknown }).status === 'error'
    ) {
        return result as WithPlain<T>;
    }
    // **봉투가 아니라 분석 payload를 넘긴다.** 액션은 `{ status, result, ... }`를
    // 돌려주는데, 봉투째 넘기면 `extractProse`가 모든 경로에 `result.` 접두를 붙여
    // `dropSupersededPaths`(bare 경로로 매칭)가 조용히 no-op이 된다 — 그러면 보정
    // 전/후 매매 가격 두 벌이 함께 프롬프트에 실려, 그 함수가 막으려던 모순
    // 출력("다른 분석에서는 목표가를…")이 그대로 재현된다. 리뷰에서 잡혔다.
    const envelope = result as { result?: unknown };
    const payload =
        typeof envelope.result === 'object' && envelope.result !== null
            ? envelope.result
            : result;
    const plain = await rewriteToPlainLanguage(
        payload,
        symbol,
        locale,
        currencyForSymbol(symbol),
        await resolveCurrentPrice(symbol, payload)
    );
    return { ...(result as object), plain } as WithPlain<T>;
}

/**
 * 로케일 번역과 평이화를 함께 적용한다. 둘은 서로 독립이라 병렬로 돈다.
 *
 * `symbol`이 없으면(종목과 무관한 분석) 평이화를 건너뛴다 — `facts.symbol`이
 * 프롬프트의 사실 블록에 들어가므로 빈 값을 넘기면 안 된다.
 */
function withReaderViews<T>(
    work: Promise<T>,
    locale: Locale,
    type: AnalysisType,
    symbol: unknown,
    /**
     * 봇 요청이면 평이화를 건너뛴다.
     *
     * ## 세 가지 이유가 같은 한 줄로 해결된다
     *
     * 1. **비용.** `skipEnqueueIfMiss`가 크롤러의 LLM 지출을 막는 장치인데 평이화는
     *    그 뒤에 붙어 커버되지 않았다. 캐시 HIT를 받은 봇이 매 크롤마다 DeepSeek
     *    왕복을 태운다 — prewarm이 평이화 캐시를 채우지 않으므로 롱테일 종목은
     *    항상 미스다.
     * 2. **동시성.** 봇에 2배 천장을 주는 근거가 "봇의 캐시 미스는 즉시 끝나므로
     *    슬롯을 밀리초만 붙든다"인데(아래 `canAcceptAnalysisStream` 주석), 평이화가
     *    붙으면 봇이 슬롯을 최대 15초 붙든다. 그 전제가 깨진다.
     * 3. **SEO.** robots.txt가 이 라우트를 크롤러에 일부러 열어 두었다 — 즉
     *    **크롤러는 라이브 분석을 실제로 렌더한다.** 설계 문서 §11이 "SEO 영향 0"의
     *    근거로 삼은 "라이브 분석은 색인되지 않는다"는 전제가 사실이 아니었다.
     *    기본값이 쉽게보기이므로(localStorage가 빈 크롤러는 항상 기본값) 봇이 받는
     *    본문이 지표·패턴 이름이 제거된 37% 압축 산문으로 바뀐다. 2026-07 thin
     *    콘텐츠 절벽에서 회복한 상태를 되돌릴 수 있다.
     *
     * 사람 트래픽에는 영향이 없고, 봇은 지금까지와 똑같은 원본을 받는다.
     */
    isBotRequest: boolean
): Promise<T> {
    const plainEnabled =
        !isBotRequest &&
        typeof symbol === 'string' &&
        symbol.length > 0 &&
        PLAIN_ENABLED_TYPES.has(type);
    const gated = withLocalizedGateError(work, locale);
    if (!plainEnabled) return gated;

    return gated.then(async result => {
        /**
         * **호출부에도 안전망을 둔다.** `rewriteToPlainLanguage`가 "절대
         * reject하지 않는다"를 계약으로 지키지만, 그 계약이 한 번 깨지면
         * 성공한 분석이 통째로 에러 프레임이 된다 — 장식 레이어가 감당할
         * 수 있는 실패가 아니다. 계약과 안전망을 둘 다 둔다.
         */
        const withPlain = await withPlainLanguage(
            result,
            symbol as string,
            locale
        ).catch((error: unknown) => {
            console.error('[withPlainLanguage] unexpected throw', error);
            return result as WithPlain<T>;
        });
        return {
            ...(result as object),
            plain: (withPlain as { plain?: string | null }).plain ?? null,
        } as T;
    });
}

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
            // 번역자는 핸들러 진입부에서 한 번만 확보한다 — E2E 분기부터 마지막
            // 스트림까지 모든 `heartbeatStream` 호출이 로케일별 제네릭 문구를
            // 필요로 하고, 동시성 검사와 스트림 생성 사이에 `await`가 들어가면
            // 원자성이 깨지기 때문이다.
            const requestLocale = resolveRequestLocale(request);
            const t = await streamMessages(requestLocale);

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
                            }),
                            { genericErrorMessage: t('generic') }
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
                        }),
                        { genericErrorMessage: t('generic') }
                    ),
                    { headers: SSE_HEADERS }
                );
            }

            // --- 2c. Bot detection → skip enqueue on miss ---
            const skipEnqueueIfMiss = isBot(request.headers);

            // --- 2d. Market profile → assetClass + session-aware data provider ---
            const marketProfile = await resolveMarketProfile(symbol);
            const descriptor = getDescriptor(marketProfile);
            const { assetClass } = descriptor;
            const marketDataProvider = getCachedMarketDataProvider(
                sessionSpecFor(marketProfile)
            );

            // --- 2e. Tier + BYOK gate ---
            let tier: 'free' | 'member' | 'pro';
            let userApiKey: string | undefined;

            if (modelId === undefined) {
                tier = await resolveTierOnly(userId);
            } else {
                const gate = await resolveTierAndByok(
                    userId,
                    modelId,
                    requestLocale
                );
                if (gate.kind === 'blocked') {
                    /**
                     * Stream the gate error as an SSE `error` event so the client
                     * receives the localized message. A 403 HTTP response would cause
                     * `runAnalysisStream` to throw a generic "분석 요청이 실패했습니다 (403)"
                     * instead of the gate-specific message.
                     */
                    // 게이트 거부는 **가용성 장애가 아니다**(사용자가 허용되지 않은
                    // 모델을 고른 정상 동작). `[analysis-stream] failed` 알람이 이걸
                    // 세면 프리티어 사용자 몇 명이 프리미엄 모델을 눌렀다는 이유로
                    // 페이지가 울리고, 그 알람은 SSE가 항상 200이라 진짜 분석 장애를
                    // 잡는 **유일한** 신호다. 따로 로깅해 구분한다.
                    console.warn(
                        '[analysis-stream] gate-denied:',
                        gate.error.code
                    );
                    return new Response(
                        heartbeatStream(
                            // 게이트 문구는 사용자에게 보여줄 목적으로 만들어진
                            // 것이라 그대로 통과해야 한다.
                            Promise.reject(
                                new LocalizedStreamError(
                                    await gateMessage(
                                        requestLocale,
                                        gate.error.code
                                    )
                                )
                            ),
                            {
                                logFailures: false,
                                genericErrorMessage: t('generic'),
                            }
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
            // core의 `onPromptAssembled`는 캐시 미스에서 정확히 한 번, 프로바이더
            // 호출 직전에 **동기로** 캡처만 한다 — 여기서 await하지 않는다(Task S2
            // 계약, `schedulePersistAnalysisHistory` 주석 참고).
            let capturedPrompt: AssembledPromptRecord | undefined;

            // Task S3 (prior-analysis-context) — `priorAnalyses` itself is
            // fetched further down, inside the `withDeadline` work closure
            // (audit finding: it used to be read here, before the
            // concurrency cap below, so every non-bot request paid an
            // indexed query even when about to be 503'd). See the comment
            // at that call site for why moving it there is still safe for
            // the cap-check atomicity this function also has to preserve.
            const options: SubmitAnalysisOptions = {
                modelId,
                skipEnqueueIfMiss,
                marketDataProvider,
                assetClass,
                // core는 심볼에서 통화를 추론하지 않는다 — 거래소 프로파일을
                // 아는 쪽이 여기다. 넘기지 않으면 원화 종목의 손절·목표가가
                // `$121980.70`처럼 달러 기호와 있지도 않은 소수 정밀도를 달고
                // 나온다(코퍼스 실측: 원화 종목 20건 중 19건).
                currency: descriptor.priceFormat.currency,
                tierContext: { userId, tier },
                reasoning: resolveReasoning(tier, reasoning),
                positionBucket,
                onPromptAssembled: record => {
                    capturedPrompt = record;
                },
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
                        }),
                        { genericErrorMessage: t('generic') }
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

            /**
             * 동시 분석 상한 — 근거는 `canAcceptAnalysisStream` 주석 참고.
             *
             * 검사를 **작업 생성 직전**에 둔다. 진입부에서 검사하면 게이팅 await
             * 대여섯 개를 사이에 두게 되고, 그 창에 몰려든 요청이 전부 증가 전의 같은
             * 카운트를 읽어 모두 통과한다(정확히 이 상한이 막으려던 버스트다).
             * 여기서는 검사 → `heartbeatStream` 사이에 await가 없어 단일 스레드에서
             * 원자적이다(카운터 증가는 `heartbeatStream`의 start에서 일어난다).
             *
             * JSON 503으로 거절한다 — SSE로 error를 흘리면 클라이언트가 "분석 실패"로
             * 표시하지만, 이건 실패가 아니라 "지금 말고 나중에"다.
             */
            /**
             * 봇은 상한에서 제외한다. `skipEnqueueIfMiss`(위) 때문에 봇의 캐시 미스는
             * LLM을 태우지 않고 즉시 `miss_no_trigger`로 끝나므로, 봇 요청이 슬롯을
             * 붙드는 시간은 밀리초 단위다 — 상한이 막으려는 부하가 아니다.
             *
             * 반대로 막으면 손해가 크다: 이 브랜치는 크롤러 렌더러가 분석을 받게
             * 하려고 robots.txt에 `/api/analysis/stream`을 일부러 열었는데, 사람
             * 트래픽이 슬롯을 채운 동안 Googlebot이 503을 받으면 렌더된 DOM에 실패
             * 배너만 남는다. robots 예외를 넣은 이유가 그대로 무너진다.
             */
            // ⚠️ 번역자는 **동시성 검사 이전에** 확보한다. 검사와
            // `heartbeatStream` 사이에 `await`가 들어가면 위 주석이 설명한
            // 원자성이 깨진다 — 그 틈에 도착한 요청이 같은 빈 슬롯을 보고
            // 전부 통과해 캡이 무의미해진다(`getTranslations`는 로케일당 첫
            // 호출에서 실제 비동기 작업을 한다). 503 분기도 이 값을 쓴다.
            if (!canAcceptAnalysisStream(skipEnqueueIfMiss)) {
                console.warn(
                    '[analysis-stream] rejected: concurrency cap reached'
                );
                await releaseOnFailure();
                return Response.json(
                    { error: t('busy') },
                    { status: 503, headers: { 'Retry-After': '30' } }
                );
            }

            const work = withDeadline(async deadlineSignal => {
                // Task S3 (prior-analysis-context) — read here, i.e.
                // AFTER the concurrency cap above and still BEFORE the
                // `runAnalysis` call directly below. core folds a
                // fingerprint of `priorAnalyses` into the cache key, so
                // it has to be resolved before `runAnalysis` is invoked
                // (a lazy read-on-miss would let the key computation
                // and the prompt rendering see different history sets
                // for the same request) — but it no longer has to be
                // resolved before the cap check, and reading it here
                // means a request `canAcceptAnalysisStream` rejects
                // with 503 never pays for this indexed query at all,
                // which is exactly the DB load a capacity spike should
                // not carry.
                //
                // This does NOT reintroduce the await the cap-check
                // comment above warns about: `withDeadline` invokes
                // this closure via `(async () => run(signal))()`, and
                // calling an async function runs synchronously up to
                // its first `await` — so the call to `withDeadline`
                // itself still returns synchronously, with no yield to
                // the event loop between the cap check and
                // `heartbeatStream` registering the stream below. The
                // `await` below only ever suspends *this* closure,
                // which already only exists because the cap check
                // passed.
                const priorAnalyses = skipEnqueueIfMiss
                    ? undefined
                    : await new DrizzleAnalysisHistoryRepository(
                          getDatabaseClient().db
                      ).findRecentForPrompt({
                          symbol,
                          timeframe,
                          tab: 'technical',
                      });

                return runAnalysis(
                    symbol,
                    companyName,
                    timeframe,
                    force,
                    fmpSymbol,
                    {
                        ...options,
                        priorAnalyses,
                        /*
                         * **`locale`을 core에 그대로 넘긴다.** 나머지 일곱
                         * 축이 이미 이렇게 배선돼 있다 — core가 대상 언어로
                         * 직접 쓰고(`outputLanguageContract`), 로케일은 core
                         * 캐시 키에도 접힌다.
                         *
                         * 이 축만 사후 번역에 기대고 있었는데, 그 계층은 이
                         * 커밋에서 걷어냈다. 남겨 두면 core가 영어로 쓴
                         * 산출물이 "한국어를 번역하라" 프롬프트로 들어가
                         * 망가진다.
                         */
                        locale: requestLocale,
                        signal: deadlineSignal,
                    }
                ).then(result => ({
                    ...result,
                    personalized: positionBucket !== undefined,
                }));
            }, t('timeout')).catch(async (err: unknown) => {
                await releaseOnFailure();
                throw err;
            });

            // Task S2 (prior-analysis-context) — persist newly-generated
            // ('done') results only; 'cached' rows already exist. This is an
            // INDEPENDENT subscriber on `work` (does not replace the
            // `heartbeatStream(withReaderViews(work, ...))` consumer below),
            // so it needs its own rejection handler or a timeout/gate-error
            // here becomes an unhandled rejection.
            work.then(result => {
                if (result.status !== 'done') return;
                schedulePersistAnalysisHistory({
                    symbol,
                    timeframe,
                    tab: 'technical',
                    modelId: modelId ?? DEFAULT_TECHNICAL_MODEL_ID,
                    locale: requestLocale,
                    result: result.result,
                    prompt: capturedPrompt,
                });
            }).catch(() => {
                // Analysis failed/timed out/aborted — nothing to persist.
                // The real error is already surfaced to the client via
                // `withReaderViews(work, ...)` below.
            });

            return new Response(
                heartbeatStream(
                    withReaderViews(
                        work,
                        requestLocale,
                        'technical',
                        body.params.symbol,
                        skipEnqueueIfMiss
                    ),
                    {
                        genericErrorMessage: t('generic'),
                    }
                ),
                { headers: SSE_HEADERS }
            );
        } catch (err) {
            console.error('[streamAnalysisRoute] unexpected error:', err);
            return Response.json(
                {
                    status: 'error',
                    // ⚠️ `...await buildGateError(...)`가 아니라 명시적으로 쓴다.
                    // 스프레드에 Promise를 넣으면 런타임에 `{}`가 되어 `code`가
                    // 조용히 사라진다(타입체크는 통과한다 — 실측 확인).
                    // catch 블록이라 try 안의 `requestLocale`이 스코프 밖이다.
                    error: await buildGateError(
                        'unexpected_error',
                        resolveRequestLocale(request)
                    ),
                },
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

    // 번역자는 동시성 검사 **이전에** 확보한다 — 검사와 스트림 생성 사이에
    // await가 들어가면 원자성이 깨진다(위 technical 분기 주석 참고).
    const locale = resolveRequestLocale(request);
    const t = await streamMessages(locale);
    // 한 번만 계산해 동시성 상한·DISPATCH(overall의 히스토리 읽기 skip)·
    // withReaderViews 세 곳에서 재사용한다 — 각자 다시 계산해도 값은 같지만
    // (Headers read, side-effect 없음) 하나로 묶는 게 더 명확하다.
    const isBotRequest = isBot(request.headers);

    // 동시 분석 상한. 봇은 더 높은 천장 — 근거는 `canAcceptAnalysisStream` 주석.
    if (!canAcceptAnalysisStream(isBotRequest)) {
        console.warn('[analysis-stream] rejected: concurrency cap reached');
        return Response.json(
            { error: t('busy') },
            { status: 503, headers: { 'Retry-After': '30' } }
        );
    }

    try {
        const work = withDeadline(
            deadlineSignal =>
                handler(body.params, deadlineSignal, locale, isBotRequest),
            t('timeout')
        );
        return new Response(
            heartbeatStream(
                withReaderViews(
                    work,
                    locale,
                    body.type,
                    body.params.symbol,
                    isBotRequest
                ),
                { genericErrorMessage: t('generic') }
            ),
            { headers: SSE_HEADERS }
        );
    } catch (err) {
        console.error('[streamAnalysisRoute] unexpected error:', err);
        return Response.json(
            {
                status: 'error',
                error: await buildGateError('unexpected_error', locale),
            },
            { status: 500 }
        );
    }
}
