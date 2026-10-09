import type {
    AssembledPromptRecord,
    ModelId,
    Timeframe,
} from '@y0ngha/siglens-core';
import { after } from 'next/server';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import { getTranslations } from 'next-intl/server';
import type { AnalysisGateErrorCode } from '@/shared/lib/types';
import type { Locale } from '@/shared/i18n/locales';
import { localeFromRequestHeader } from '@/shared/lib/localeFromRequestHeader';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { resolveHoldingPositionBucket } from '@/entities/portfolio/lib/resolveHoldingPositionBucket';
import { logActionError } from '@/shared/lib/logActionError';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    resolveCurrentPrice,
    resolvePriceAsOf,
} from '@/entities/analysis-plain/lib/currentPrice';
import { rewriteToPlainLanguage } from '@/entities/analysis-plain/api';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    currencyForSymbol,
    getDescriptor,
} from '@/shared/config/marketProfile/registry';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { getDatabaseClient } from '@/shared/db/client';
import {
    buildGateError,
    type ByokOutcome,
    resolveTierAndByok,
    resolveTierOnly,
    resolveReasoning,
} from '@/shared/lib/byokGate';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { heartbeatStream } from '@/shared/lib/sse/heartbeatStream';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { runAnalysis, type SubmitAnalysisOptions } from './runAnalysisBridge';
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis/lib/reanalyzeCooldown';
import {
    DrizzleAnalysisHistoryRepository,
    resolveGeneratedAt,
    type AnalysisHistoryTab,
} from '@/entities/analysis/analysisHistoryRepository';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
// core에서 직접 import — 해제는 서버 전용이어야 한다(클라이언트가 호출할 수 있으면
// 쿨다운을 지우고 재요청하는 루프로 무력화된다). 아래 `releaseOnFailure` 참고.
import { releaseReanalyzeCooldown } from '@y0ngha/siglens-core';
import {
    createGenerationGateSlot,
    createGuestResolver,
    createPromptAssemblyTracker,
    DONE_STATUS_PROBE,
    promptAssembledProbe,
    releaseGenerationGate,
    reserveGenerationGate,
    settleGenerationGate,
    shouldAttemptReanalyze,
    type GenerationGate,
} from './generationQuota';
import { meterPayload, resolveMeterGate } from './meteredRevealGate';

// Actions: gating + data-fetch already live in each entity's action file.
// Calling them from the route (server-side) is safe — no browser connection means
// no idle-connection wall at all. The SSE heartbeat stream keeps the browser
// connection alive while these actions await the LLM.
import { runOverallAnalysisAction } from '@/entities/analysis/actions/runOverallAnalysisAction';
import { runFundamentalAnalysisAction } from '@/entities/analysis/actions/runFundamentalAnalysisAction';
import { runFinancialsAnalysisAction } from '@/entities/analysis/actions/runFinancialsAnalysisAction';
import { runCongressTrendAction } from '@/entities/analysis/actions/runCongressTrendAction';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions/submitNewsAnalysisAction';
import { submitMarketNewsDigestAction } from '@/entities/market-news/actions/submitMarketNewsDigestAction';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions/optionsActions';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions/submitMarketBriefingAction';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';

/**
 * 불변식: **응답 본문은 User-Agent에 의존하지 않는다.** 봇과 사람은 같은 요청에
 * 같은 본문(원문 + 평이화)을 받는다.
 *
 * **생성 트리거도 이제 UA로 가르지 않는다 (2026-09-27).** 캐시 미스면 봇도
 * 사람과 똑같이 core에 생성을 맡긴다 — 예전엔 봇이면 `skipEnqueueIfMiss`로
 * 즉시 `miss_no_trigger`를 돌려줬는데, 그게 Googlebot이 색인하는 DOM을
 * "봇 트래픽으로 보여 표시하지 않았어요" 안내문으로 만드는 원인이었다.
 *
 * **UA만으로는 이 라우트의 어떤 동작도 바뀌지 않는다.** 예전 UA 분기(동시성
 * 상한의 봇 배수)는 제거했다 — `isBot`은 순수 UA 문자열 매칭이라
 * curl/python-requests/axios 같은 일반 스크립트 클라이언트까지 "봇"으로 잡히는데,
 * 거기에 더 높은 동시성 천장을 얹는 건 판별 불가능한 신호에 의존하는 남용
 * 경로였다. 상한 근거는 `shared/lib/sse/activeStreams.ts`의
 * `canAcceptAnalysisStream` 주석 참고.
 *
 * **지금 UA를 읽는 곳은 하나다(2026-10-07): 생성 한도의 크롤러 면제.** UA는
 * 검색 크롤러(Googlebot·Bingbot·Yeti·Daumoa)를 *주장할 때* DNS 검증을 **시도할지**만
 * 정한다. 면제는 역방향(PTR) → 크롤러 도메인 접미사 → 순방향 조회가 원래 IP와
 * 맞물릴 때만 주어진다(`shared/api/verifiedCrawler.ts`). 검증하는 IP는 Cloudflare가
 * 덮어쓰는 `cf-connecting-ip`뿐이다(위조 가능한 `X-Forwarded-For` 폴백은 면제에 안
 * 쓴다 — `generationQuota.ts`의 `isVerifiedCrawlerRequest`). 위조 UA는 DNS에서 떨어져
 * 평소 한도를 그대로 받고, 크롤러를 주장하지 않는 UA는 DNS 조회조차 하지 않는다.
 * 면제는 생성 한도에만 적용된다 — 동시성 상한·본문·생성 트리거는 그대로다.
 *
 * **같은 크롤러 판정이 두 번째로 쓰이는 곳: 비회원 하루 무료 전체 공개 미터
 * (2026-10-18 시행, `meteredRevealGate.ts`).** DNS로 검증된 크롤러는 미터를 건너뛰어
 * 항상 현행 free 마스킹을 받는다. 갈리는 기준은 UA가 아니라 검증 결과이고, 미터 대상
 * 방문자가 공개 본문을 받아도 색인되는 SEO 스냅샷(`peekAnalysisStatic`, tier free
 * 고정)은 변하지 않는다.
 */
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
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`). 생략·`false`면
     * 지금과 같은 동작이라 클라이언트가 이 값을 속여도 새 비용 경로가 생기지 않는다.
     */
    cacheOnly?: boolean;
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
 * On 2026-08-09 a `deepseek-v4.1-pro` call on PLTR (promptTokens 29k) returned in
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
 * 대신 폭주 방지는 `withDeadline`(`STREAM_DEADLINE_MS`, 10분)이 담당한다 — 클라이언트
 * 유무와 무관한 상한이다.
 */

/**
 * `run(signal)`을 고정 마감과 경주시킨다. 마감을 넘기면 localized 메시지로 reject해
 * `heartbeatStream`이 SSE `error` 이벤트를 내보내고 연결을 닫는다.
 *
 * 마감이 **자체 `AbortController`로 작업을 실제 취소**하는 게 핵심이다. 취소하지 않으면
 * 스트림만 닫히고 core의 호출은 provider 타임아웃(어댑터 기본 1시간)까지 계속 살아 있다.
 * 그 promise는 `dedupeInFlight` Map에 남으므로, 같은 캐시 키의 이후 요청이 전부 죽은
 * promise에 합류해 `STREAM_DEADLINE_MS`(10분)씩 기다렸다 실패한다 — 한 번의 provider
 * 행이 그 키를 최대 한 시간 봉인한다.
 *
 * 이 signal은 클라이언트별이 아니라 **작업별**이라, 위에서 설명한 공유 abort 문제가 없다:
 * 누가 듣고 있든 `STREAM_DEADLINE_MS`가 지나면 그 작업 자체가 가망이 없다.
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
    // work가 먼저 끝나면 타이머를 즉시 회수한다 — 없으면 매 요청이 STREAM_DEADLINE_MS짜리
    // 타이머와 그 reject 클로저를 붙들고 있어, LLM 작업까지 떠안은 인스턴스에서 그대로 누적된다.
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
 * 생성 한도가 디스패치 핸들러에 넘기는 값. 한도 초과면 `cacheOnly`가 켜져 캐시만
 * 조회하고, 재분석(캐시 우회 = 새 생성) 의도도 무시한다.
 */
interface DispatchQuotaContext {
    /** 클라이언트의 `cacheOnly` 요청 **또는** 한도 초과 강등. */
    readonly cacheOnly: boolean;
    readonly rateLimited: boolean;
    /** core가 프롬프트를 조립했을 때 부른다 — 생성 여부 판정(`promptAssembledProbe`). */
    readonly onPromptAssembled: () => void;
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
 *
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
        quota: DispatchQuotaContext
    ) => Promise<unknown>
> = {
    overall: async (params, signal, locale, quota) => {
        // technical과 같은 규칙 — 클라이언트는 의도만 보내고, 캐시 우회 여부는
        // 서버가 쿨다운 획득으로 판단한다. 키 namespace를 분리해(`<tf>:overall`)
        // 기술적 분석 재분석이 종합 분석 재분석을 막지 않게 한다.
        const cooldown = shouldAttemptReanalyze(
            params.reanalyze,
            quota.rateLimited
        )
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

        // Task S3 (prior-analysis-context) — read history BEFORE the core
        // call, unconditionally. core folds a fingerprint of `priorAnalyses`
        // into the cache key, so a lazy read-on-miss would let the key
        // computation and the prompt rendering see different history sets
        // for the same request. This costs one indexed query per request.
        //
        // 2026-09-27: 봇 요청도 여기서 건너뛰지 않는다. 봇의 캐시 미스도 이제
        // 사람과 똑같이 생성을 트리거하므로(파일 상단 "본문은 UA에 의존하지
        // 않는다" 불변식), 이 값을 건너뛰면 같은 캐시 키인데 프롬프트 입력만
        // 다른 두 벌의 본문이 생긴다 — 정확히 이 불변식이 금지하는 것이다.
        //
        // 두 벌을 따로 읽는다 — technical 탭과 overall의 technical 축은
        // recency 윈도우가 다르다(`ANALYSIS_CACHE_TTL[timeframe]` vs
        // `OVERALL_CACHE_TTL_SECONDS`, `analysisHistoryQuery`의 axis 인자
        // 참고). 예전엔 하나의 배열을 technical 축과 overall 자신의 top-level
        // `priorAnalyses`에 동시에 흘려보냈는데, 두 축의 윈도우가 다르므로
        // 한쪽은 틀린 창으로 읽은 이력을 갖게 됐다.
        const overallDb = getDatabaseClient().db;
        const historyRepo = new DrizzleAnalysisHistoryRepository(overallDb);
        // 이벤트 창의 세션 — `runOverallAnalysisAction`이 technical 축에 넘기는 것과 같은
        // 프로필에서 만든다. 이벤트는 technical 탭과 공유하는 캐시 키에 접히므로, 여기서
        // 다른 세션을 쓰면 overall이 technical을 한 번 더 생성한다.
        const eventsSession = sessionSpecFor(
            await resolveMarketProfile(symbol)
        );
        const [technicalPriorAnalyses, overallPriorAnalyses, marketEvents] =
            await Promise.all([
                // overall의 **technical 축**이 참고할 이력 — technical 탭과
                // 캐시 키(`:hist=`)를 공유하려면 그 탭과 동일한 axis(=
                // 'technical', 기본값)로 읽어야 한다.
                historyRepo.findRecentForPrompt({
                    symbol,
                    timeframe,
                    // overall도 **technical 이력**을 참고한다.
                    //
                    // `PriorAnalysis`는 trend / riskLevel / 진입·손절·익절이라
                    // 본질적으로 technical 모델인데, `OverallAnalysisResponse`에는
                    // 그 필드가 하나도 없다(headline·bullets·scenarios·riskFactors가
                    // 전부다). 그래서 overall 결과로 만든 행은 `toPriorAnalysis`가
                    // 남김없이 버린다 — `tab: 'overall'`로 읽으면 이 섹션은 영원히
                    // 비어 있다.
                    //
                    // overall은 technical 산출물을 입력으로 받아 종합하는 축이므로,
                    // "이 종목을 이전엔 이렇게 봤다"는 technical 판단은 여기서도
                    // 그대로 유효한 참고다.
                    tab: 'technical',
                    // `runOverallAnalysisAction`이 `technical.session`으로 core에
                    // 넘기는 것과 같은 세션 — 이력 쿼리의 `generatedBeforeMs`가
                    // core의 캐시 키 경계(세션 마감)와 맞아야 한다.
                    session: eventsSession,
                }),
                // overall **자신의** top-level `priorAnalyses` — overall의
                // recency 윈도우(`OVERALL_CACHE_TTL_SECONDS`)로 읽는다.
                historyRepo.findRecentForPrompt({
                    symbol,
                    timeframe,
                    tab: 'technical',
                    axis: 'overall',
                    session: eventsSession,
                }),
                findMarketEventsForPrompt(overallDb, {
                    symbol,
                    ...marketEventsLookback(timeframe, eventsSession),
                }),
            ]);

        const result = await runOverallAnalysisAction(
            symbol,
            params.companyName as string,
            timeframe,
            modelId,
            locale,
            {
                force: cooldown?.ok === true,
                reasoning: params.reasoning as boolean | undefined,
                priorAnalyses: overallPriorAnalyses,
                technicalPriorAnalyses,
                marketEvents,
                cacheOnly: quota.cacheOnly,
                onPromptAssembled: quota.onPromptAssembled,
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

        // overall 결과는 이력으로 저장하지 않는다.
        //
        // `OverallAnalysisResponse`에는 `PriorAnalysis`가 요구하는 trend /
        // riskLevel이 없어서, 저장해도 `toPriorAnalysis`가 전부 버린다. 남는 건
        // 90일짜리 사문(死文) 행과 그 프롬프트 블롭뿐이다. 이 축이 참고하는
        // 이력은 위 `findRecentForPrompt`가 읽는 technical 쪽이다.

        return result;
    },

    fundamental: (params, signal, locale, quota) =>
        runFundamentalAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    financials: (params, signal, locale, quota) =>
        runFinancialsAnalysisAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    news: (params, signal, locale, quota) =>
        submitNewsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    marketNewsDigest: (params, signal, locale) =>
        submitMarketNewsDigestAction(
            params.category as NewsFeedCategoryId,
            locale,
            signal
        ),

    options: (params, signal, locale, quota) =>
        submitOptionsAnalysisAction(
            params.symbol as string,
            params.companyName as string,
            params.expirationDate as OptionsExpirationSelector,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    congress: (params, signal, locale, quota) =>
        runCongressTrendAction(
            params.symbol as string,
            params.modelId as ModelId,
            locale,
            params.reasoning as boolean | undefined,
            signal,
            quota.cacheOnly
        ),

    /**
     * briefing: delegates to the market-summary entity action that owns bot
     * detection and market-summary data loading.
     */
    briefing: (params, signal) =>
        // scope는 클라이언트가 보낸 문자열이다. 여기서 좁히지 않고 그대로 넘기는 것은
        // 의도된 설계다 — 액션이 `isPageDashboardScopeId`(허브 페이지가 있는 시장만)로
        // 검증하고 그 밖의 값이면 에러를 돌려준다(라우트와 액션 양쪽에 검증을 두면
        // 규칙이 갈린다).
        submitMarketBriefingAction(params.scope as string, signal),

    // 게이트를 쓰지 않아 사용자 문구를 만들지 않는다 — 로케일이 필요 없다.
    macroBriefing: (_params, signal) => submitMacroBriefingAction(signal),
};

/**
 * 생성 한도를 걸지 않는 종류 — 종목과 무관한 허브 콘텐츠다.
 *
 * 캐시 키가 클라이언트 입력으로 늘어나지 않는다(브리핑 scope·다이제스트 카테고리는
 * 액션이 고정 목록으로 검증하고, 매크로 브리핑은 입력이 없다). 그래서 이 경로로는
 * 공격자가 생성 수를 키울 수 없고, 막으면 정상 방문자의 허브 화면만 비게 된다.
 * 방문자 재생성 빈도 자체는 각 액션의 쿨다운이 담당한다.
 */
const QUOTA_EXEMPT_TYPES: ReadonlySet<AnalysisType> = new Set([
    'briefing',
    'macroBriefing',
    'marketNewsDigest',
]);

/**
 * core `onPromptAssembled`로 생성 여부를 정확히 아는 디스패치 종류. 나머지는
 * 결과 상태로 근사한다(`DONE_STATUS_PROBE` JSDoc).
 */
const PROMPT_PROBED_TYPES: ReadonlySet<AnalysisType> = new Set(['overall']);

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
 * 사용자 화면에 그대로 렌더되는 에러 문구.
 *
 * `heartbeatStream`이 거절을 SSE `error` 이벤트의 `{ message }`로 실어 보내고,
 * `runAnalysisStream` → `useAnalysis` → `ChartContent`의 `<ErrorBanner>`가 그걸
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
 * 때문이다 — Gemini 설정(`GEMINI_API_KEY` + `gemini-3.5-flash-lite`)을 읽어
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
        await resolveCurrentPrice(symbol, payload),
        await resolvePriceAsOf(symbol, locale, payload)
    );
    return { ...(result as object), plain } as WithPlain<T>;
}

/**
 * 로케일 번역과 평이화를 함께 적용한다. 둘은 서로 독립이라 병렬로 돈다.
 *
 * `symbol`이 없으면(종목과 무관한 분석) 평이화를 건너뛴다 — `facts.symbol`이
 * 프롬프트의 사실 블록에 들어가므로 빈 값을 넘기면 안 된다.
 *
 * ## 봇과 사람은 같은 리더 뷰를 받는다 (UA 분기 없음)
 *
 * 예전엔 `isBotRequest`로 봇의 평이화를 건너뛰었다. 제거한 이유:
 *
 * - **클로킹.** 기본값이 쉽게보기라(localStorage가 빈 크롤러는 항상 기본값)
 *   봇만 원문을 받으면 봇이 보는 DOM과 기본 사람이 보는 DOM이 서로 다른 본문이
 *   된다. 의도와 무관하게 Google의 클로킹 패턴과 구분되지 않는다.
 * - **비용은 이미 저장소가 잡는다.** 평이화 결과는 원문 해시 키로 만료 없이
 *   `analysis_plain_texts`에 저장된다(`entities/analysis-plain/api.ts`). 비용은 크롤 1회당이
 *   아니라 **분석 텍스트 1건당** 발생하고, 화이트리스트 심볼은
 *   `seo_analysis_snapshots.plain`이 이미 채워져 있다.
 *
 * 생성 트리거도 UA로 가르지 않는다 — 2026-09-27부터 `skipEnqueueIfMiss`도
 * 본문과 마찬가지로 봇/사람이 같은 값(`false`)을 받는다. UA만으로는 이 라우트의
 * 동작이 바뀌지 않는다(파일 상단 불변식 참고) — 남아 있던 동시성 상한의 봇
 * 배수도 제거했고, 남은 UA 읽기는 생성 한도의 크롤러 DNS 검증 시도뿐이다.
 */
function withReaderViews<T>(
    work: Promise<T>,
    locale: Locale,
    type: AnalysisType,
    symbol: unknown
): Promise<T> {
    const plainEnabled =
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

/**
 * 클라이언트로 나가는 결과에서 `unfilteredResult`를 뺀 사본을 만든다.
 *
 * core의 `done` 결과는 이력 저장용으로 **tier 필터 전** 분석(`unfilteredResult`)을
 * 함께 싣는다. 이 값이 SSE 본문으로 직렬화되면 free 비회원도 진입가·손절·목표가·
 * 확신도를 응답 JSON에서 그대로 읽는다 — 화면의 잠금이 무의미해진다. 이력 저장
 * 구독자는 원본 `work`를 읽으므로(`result.unfilteredResult`) 이 함수는 **클라이언트
 * 쪽 가지**에만 건다. 다른 분석 타입 결과에는 이 필드가 없어 그대로 통과한다.
 */
function omitUnfiltered<T extends object>(
    result: T
): Omit<T, 'unfilteredResult'> {
    // 캐스트 근거: `unfilteredResult`는 core가 technical `done` 결과에만 붙이는 선택 필드다.
    // 다른 결과 타입에는 없으므로 구조 분해에서 `undefined`로 빠질 뿐 나머지는 그대로다.
    const { unfilteredResult: _unfiltered, ...rest } = result as T & {
        unfilteredResult?: unknown;
    };
    return rest;
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
            cacheOnly,
        } = body.params;

        // 예약은 try 안에서 하지만, 예기치 못한 예외(아래 catch)에서도 되돌릴 수 있게
        // 칸을 바깥에 둔다. 환불은 멱등이라 정산 경로와 겹쳐도 두 번 빼지 않는다.
        const quotaSlot = createGenerationGateSlot();
        // 하루 무료 공개 미터의 신규 기록도 같은 이유로 바깥 catch까지 들고 간다.
        // 해제는 멱등(SREM)이고, 신규가 아니면 아무것도 하지 않는다.
        const meterRelease: { current: () => Promise<void> } = {
            current: async () => {},
        };

        try {
            // 번역자는 핸들러 진입부에서 한 번만 확보한다 — E2E 분기부터 마지막
            // 스트림까지 모든 `heartbeatStream` 호출이 로케일별 제네릭 문구를
            // 필요로 하고, 동시성 검사와 스트림 생성 사이에 `await`가 들어가면
            // 원자성이 깨지기 때문이다.
            //
            // 번역자 로드와 인증(2a)은 서로 독립이라 함께 기다린다 — 첫 바이트 전에 쌓이는
            // 직렬 await를 줄인다(2026-10 서버 성능 감사 L5).
            const requestLocale = localeFromRequestHeader(request);
            const [t, user] = await Promise.all([
                streamMessages(requestLocale),
                // --- 2a. Auth ---
                getCurrentUser(),
            ]);
            const userId = user?.id ?? null;

            // --- 2b. E2E short-circuit ---
            //
            // 2026-09-27: 봇도 이 분기를 사람과 동일하게 통과한다. 예전엔 여기서
            // 봇이면 즉시 `miss_no_trigger`를 돌려줬는데, 그 결과 Googlebot이
            // 색인하는 DOM이 사람과 다른 "봇 트래픽으로 보여 표시하지 않았어요"
            // 안내문이 됐다 — 파일 상단 "본문은 UA에 의존하지 않는다" 불변식 위반.
            if (isE2E()) {
                const tier = await resolveTierOnly(userId);
                // Dynamic import keeps the E2E stub out of the prod bundle (dead code
                // when E2E_TEST is unset).
                const { e2eCachedTechnical, e2eGeneratedTechnical } =
                    await import('@/shared/api/e2eAnalysisStub');
                // 재분석 의도는 운영에서 캐시를 건너뛴 새 생성(`done`)으로 끝난다 — 스텁도
                // 같은 status를 줘야 클라이언트가 운영과 같은 진행 화면 흐름을 탄다
                // (`e2eGeneratedTechnical` JSDoc).
                const stub =
                    reanalyze === true
                        ? e2eGeneratedTechnical(tier)
                        : e2eCachedTechnical(tier);
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
                        logActionError(
                            '[streamAnalysisRoute] E2E personalized-flag holding read failed, degrading to false:',
                            error
                        );
                        personalized = false;
                    }
                }
                return new Response(
                    heartbeatStream(
                        Promise.resolve({
                            ...stub,
                            personalized,
                        }),
                        { genericErrorMessage: t('generic') }
                    ),
                    { headers: SSE_HEADERS }
                );
            }

            // --- 2d. Market profile (2e와 병렬) ---
            // --- 2e. Tier + BYOK gate ---
            // 둘은 서로의 결과를 쓰지 않는다(심볼 vs userId) — 함께 기다려 DB 왕복 한 단을
            // 줄인다(감사 L5). 게이트가 막히면 프로필 결과는 버려진다(읽기 전용 조회라 부작용 없음).
            const [marketProfile, gate] = await Promise.all([
                resolveMarketProfile(symbol),
                modelId === undefined
                    ? resolveTierOnly(userId).then((tier): ByokOutcome => ({
                          kind: 'allowed',
                          tier,
                      }))
                    : resolveTierAndByok(userId, modelId, requestLocale),
            ]);
            const descriptor = getDescriptor(marketProfile);
            const { assetClass } = descriptor;
            const session = sessionSpecFor(marketProfile);
            const marketDataProvider = getCachedMarketDataProvider(session);

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
                console.warn('[analysis-stream] gate-denied:', gate.error.code);
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
            const { tier, userApiKey } = gate;

            // --- 2f. Position bucket for personalized analysis ---
            const positionBucket = await resolveHoldingPositionBucket({
                userId,
                tier,
                symbol,
                quoteSymbol: fmpSymbol,
                marketDataProvider,
                logTag: '[streamAnalysisRoute] position bucket resolution failed, degrading to no-bucket:',
            });

            // --- 2f'. Generation quota (reserve → refund on no-LLM) ---
            //
            // 한도 초과면 생성 대신 캐시 전용으로 강등한다(`skipEnqueueIfMiss`).
            // 캐시가 있으면 평소대로 내주고, 없으면 `settleGenerationGate`가
            // `rate_limited` 이벤트로 바꾼다. 재분석 의도도 함께 무시한다 — 캐시
            // 우회는 곧 새 생성이다.
            // 헤더는 크롤러 DNS 검증에만 쓴다 — UA는 *시도할지*만 정한다(파일 상단 불변식).
            // 비회원 신원·크롤러 판정은 한도 예약과 미터가 한 번만 계산해 나눠 쓴다
            // (쿠키 발급·크롤러 DNS 조회가 요청당 한 번).
            const guest = createGuestResolver(request.headers);
            const quota = await quotaSlot.reserve(
                userId,
                cacheOnly === true,
                request.headers,
                guest
            );
            const quotaLimited = quota.kind === 'rate_limited';

            // --- 2f''. 비회원 하루 무료 전체 공개 미터 ---
            //
            // 동시성 검사(아래)보다 **앞**에서 판정한다 — 그 검사와 `heartbeatStream`
            // 사이에는 await가 없어야 해서다. 대신 이후의 거절 경로(쿨다운·503·예외)는
            // 신규 기록을 되돌려야 한다. `cacheOnly` 요청도 미터를 탄다(캐시 적중 결과도
            // 공개 대상). 정책·시행일·크롤러 규칙은 `resolveMeterGate` 참고.
            const meterGate = await resolveMeterGate({
                userId,
                tier,
                symbol,
                guest,
                now: new Date(),
            });
            if (meterGate.kind === 'revealed') {
                meterRelease.current = meterGate.release;
            }

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
                // 2026-09-27: 더 이상 UA로 갈라 넣지 않는다 — 파일 상단 불변식.
                // 봇의 캐시 미스도 사람과 똑같이 core에 생성을 맡긴다. `cacheOnly`는
                // UA가 아니라 클라이언트의 AI 자동 실행 게이트에서 온다.
                skipEnqueueIfMiss: cacheOnly === true || quotaLimited,
                marketDataProvider,
                // provider에 넘긴 세션과 **같은 값**을 core에 넘긴다 — 분석 캐시 TTL이
                // 그 시장의 다음 정규장 마감 + 30분(크립토는 다음 00:00 UTC)에 맞춰진다.
                // 생략하면 모든 시장이 KST 05:00(미장 마감) 경계를 써서 KR·크립토
                // 분석이 직전 세션 가격을 들고 있었다.
                session,
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
                // 공개 종목이면 마스킹만 member 깊이로 바꾼다. 캐시 키는 tier 기반이라
                // free 생성분을 그대로 재사용한다(새 LLM 호출 없음).
                ...(meterGate.kind === 'revealed'
                    ? { tierConfig: meterGate.tierConfig }
                    : {}),
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
             * 두면 Redis 장애가 재분석 기능 전체를 막는다. 진짜 상한은 이 쿨다운이
             * 아니라 요청 단위 생성 한도(`generationQuota.ts`, 비회원 fail-closed)다 —
             * 재분석도 새 생성이라 그 한도를 함께 소비한다.
             *
             * 획득은 **여기서만** 한다. 클라이언트가 미리 획득한 뒤 요청을 보내면
             * 여기서의 획득이 반드시 실패해 재분석이 영원히 캐시로 강등되고, 반대로
             * 의도 없는 일반 제출이 획득에 성공해 캐시를 우회하는 정반대 동작이 된다.
             */
            const wantsReanalyze = shouldAttemptReanalyze(
                reanalyze,
                quotaLimited
            );
            const cooldown = wantsReanalyze
                ? await tryAcquireReanalyzeCooldown(symbol, timeframe)
                : null;

            if (cooldown !== null && !cooldown.ok) {
                // 쿨다운 중 — 새 분석을 태우지 않고 남은 시간을 알려준다.
                await releaseGenerationGate(quota);
                await meterRelease.current();
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
             *
             * 사람/봇 구분 없이 같은 상한을 쓴다(2026-09-27) — DNS로 검증된
             * 크롤러도 예외가 아니다(파일 상단 불변식 참고).
             */
            // ⚠️ 번역자는 **동시성 검사 이전에** 확보한다. 검사와
            // `heartbeatStream` 사이에 `await`가 들어가면 위 주석이 설명한
            // 원자성이 깨진다 — 그 틈에 도착한 요청이 같은 빈 슬롯을 보고
            // 전부 통과해 캡이 무의미해진다(`getTranslations`는 로케일당 첫
            // 호출에서 실제 비동기 작업을 한다). 503 분기도 이 값을 쓴다.
            if (!canAcceptAnalysisStream()) {
                console.warn(
                    '[analysis-stream] rejected: concurrency cap reached'
                );
                await releaseOnFailure();
                await releaseGenerationGate(quota);
                await meterRelease.current();
                return Response.json(
                    { error: t('busy') },
                    { status: 503, headers: { 'Retry-After': '30' } }
                );
            }

            const generated = withDeadline(async deadlineSignal => {
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
                // 이력과 이벤트를 한 번에 읽는다 — 서로 독립이라 왕복을
                // 겹치는 편이 낫다. 봇 요청도 건너뛰지 않는다(2026-09-27) —
                // 봇의 캐시 미스도 사람과 똑같이 생성을 트리거하므로, 여기서
                // 건너뛰면 같은 캐시 키에 프롬프트 입력만 다른 두 벌의 본문이
                // 생긴다(파일 상단 불변식 위반).
                const technicalDb = getDatabaseClient().db;
                const [priorAnalyses, marketEvents] = await Promise.all([
                    new DrizzleAnalysisHistoryRepository(
                        technicalDb
                    ).findRecentForPrompt({
                        symbol,
                        timeframe,
                        tab: 'technical',
                        // core에 넘기는 것과 같은 세션 — 이력 경계가 core 캐시 키 경계와 맞는다.
                        session,
                    }),
                    findMarketEventsForPrompt(technicalDb, {
                        symbol,
                        // core에 넘기는 것과 같은 세션 — 1Day 창이 core 만료 경계와 맞는다.
                        ...marketEventsLookback(timeframe, session),
                    }),
                ]);

                return runAnalysis(
                    symbol,
                    companyName,
                    timeframe,
                    force,
                    fmpSymbol,
                    {
                        ...options,
                        priorAnalyses,
                        marketEvents,
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
            // 프롬프트가 조립됐다 = 이 요청이 LLM을 불렀다. 캐시 적중·동시 요청의
            // 패자·프로바이더 호출 전 실패는 조립되지 않으므로 환불된다.
            const work = settleGenerationGate(
                generated,
                quota,
                promptAssembledProbe(() => capturedPrompt !== undefined)
            );

            // Task S2 (prior-analysis-context) — persist newly-generated
            // ('done') results only; 'cached' rows already exist.
            //
            // ⚠️ `'done'` does NOT mean this request generated the analysis:
            // `dedupeInFlight` hands the winner's result to every concurrent
            // loser, and they all see `'done'`. The duplicate is actually
            // rejected inside `saveAnalysisHistory`, which keys off `prompt`
            // being absent — see its JSDoc.
            //
            // This is an
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
                    // 이력에는 **필터 전** 결과를 남긴다.
                    //
                    // `result.result`는 이 요청의 tier가 *볼 수 있는* 만큼만
                    // 담는다. free의 `infoDepth`는 direction/summary/
                    // skill_detection뿐이라 `riskLevel`이 null로 내려오고,
                    // `PriorAnalysis`는 trend와 riskLevel을 모두 요구하므로 그
                    // 모양으로 저장하면 이후 모든 읽기가 그 행을 버린다.
                    // 비회원 방문자와 SEO pre-warm(캐시 키에 tier가 접혀 올릴 수
                    // 없다)이 분석 대부분을 만들므로, 렌더용 값을 저장하면 이력이
                    // 정작 그걸 채워야 할 트래픽에서 조용히 비어 있게 된다.
                    result: result.unfilteredResult,
                    prompt: capturedPrompt,
                });
            }).catch(() => {
                // Analysis failed/timed out/aborted — nothing to persist.
                // The real error is already surfaced to the client via
                // `withReaderViews(work, ...)` below.
            });

            // 클라이언트로 나가는 가지. 이력 저장 구독자(위)는 원본 `work`를 읽는다.
            //
            // 결과 없이 끝난 요청(에러·`miss_no_trigger`·한도 초과 캐시 전용 폴백의
            // reject)은 공개 횟수를 쓰지 않도록 미터 기록을 되돌린다. `meter` 필드는
            // 결과가 있는 `cached`·`done`에만 싣는다.
            const clientWork = work.then(
                result => {
                    if (
                        result.status !== 'cached' &&
                        result.status !== 'done'
                    ) {
                        void meterRelease.current();
                        return omitUnfiltered(result);
                    }
                    return {
                        ...omitUnfiltered(result),
                        ...meterPayload(meterGate),
                    };
                },
                (error: unknown) => {
                    void meterRelease.current();
                    throw error;
                }
            );

            return new Response(
                heartbeatStream(
                    withReaderViews(
                        clientWork,
                        requestLocale,
                        'technical',
                        body.params.symbol
                    ),
                    {
                        genericErrorMessage: t('generic'),
                    }
                ),
                { headers: SSE_HEADERS }
            );
        } catch (err) {
            console.error('[streamAnalysisRoute] unexpected error:', err);
            await quotaSlot.release();
            await meterRelease.current();
            return Response.json(
                {
                    status: 'error',
                    // ⚠️ `...await buildGateError(...)`가 아니라 명시적으로 쓴다.
                    // 스프레드에 Promise를 넣으면 런타임에 `{}`가 되어 `code`가
                    // 조용히 사라진다(타입체크는 통과한다 — 실측 확인).
                    // catch 블록이라 try 안의 `requestLocale`이 스코프 밖이다.
                    error: await buildGateError(
                        'unexpected_error',
                        localeFromRequestHeader(request)
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
    const locale = localeFromRequestHeader(request);
    const t = await streamMessages(locale);

    // 생성 한도 예약도 동시성 검사 **이전**이다 — 같은 원자성 이유.
    const params = body.params;
    const clientCacheOnly = params.cacheOnly === true;
    const quota: GenerationGate = QUOTA_EXEMPT_TYPES.has(body.type)
        ? { kind: 'exempt' }
        : await reserveGenerationGate(
              // 세션 조회 실패는 비회원으로 본다 — 한도가 엄격해질 뿐 생성이 새지 않는다.
              (
                  await getCurrentUser().catch((error: unknown) => {
                      console.error(
                          '[streamAnalysisRoute] session lookup failed:',
                          error
                      );
                      return null;
                  })
              )?.id ?? null,
              clientCacheOnly,
              request.headers
          );
    const promptTracker = createPromptAssemblyTracker();
    const quotaContext: DispatchQuotaContext = {
        cacheOnly: clientCacheOnly || quota.kind === 'rate_limited',
        rateLimited: quota.kind === 'rate_limited',
        onPromptAssembled: promptTracker.onPromptAssembled,
    };

    // 동시 분석 상한 — 사람/봇 구분 없이 같은 값을 쓴다. 근거는
    // `canAcceptAnalysisStream` 주석 참고.
    if (!canAcceptAnalysisStream()) {
        console.warn('[analysis-stream] rejected: concurrency cap reached');
        await releaseGenerationGate(quota);
        return Response.json(
            { error: t('busy') },
            { status: 503, headers: { 'Retry-After': '30' } }
        );
    }

    try {
        const work = settleGenerationGate(
            withDeadline(
                deadlineSignal =>
                    handler(params, deadlineSignal, locale, quotaContext),
                t('timeout')
            ),
            quota,
            PROMPT_PROBED_TYPES.has(body.type)
                ? promptTracker.probe
                : DONE_STATUS_PROBE
        );
        return new Response(
            heartbeatStream(
                withReaderViews(work, locale, body.type, body.params.symbol),
                { genericErrorMessage: t('generic') }
            ),
            { headers: SSE_HEADERS }
        );
    } catch (err) {
        console.error('[streamAnalysisRoute] unexpected error:', err);
        await releaseGenerationGate(quota);
        return Response.json(
            {
                status: 'error',
                error: await buildGateError('unexpected_error', locale),
            },
            { status: 500 }
        );
    }
}
