import 'server-only';
import {
    runAnalysis,
    type AnalysisResponse,
    type OptionsAnalysisResponse,
    type OverallAnalysisResponse,
    type SubmitAnalysisOptions,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { runOverallAnalysisAction } from '@/entities/analysis/actions';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import { registerActiveStream } from '@/shared/lib/sse/activeStreams';
import { AGENT_BUSY_LOG } from '../busyLog';
import { fitProse, type ProseSpec } from './fitProse';
import type { ToolExecutor } from './index';
import {
    fitTechnicalAnalysis,
    projectTechnicalAnalysis,
} from './projectTechnicalAnalysis';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

/**
 * Per-instance concurrency cap — distinct from core's per-turn cap. Each run
 * holds an SSE slot for 30–250s; beyond this the call answers `busy` rather
 * than queueing. Raised 2 → 10 (2026-09-13) now that one turn may run up to
 * 3 analyses and several users can do so at once.
 */
const MAX_CONCURRENT_FRESH = 10;
let inFlight = 0;
export function __resetFreshSemaphoreForTests(): void {
    inFlight = 0;
}

const DEFAULT_TIMEFRAME: Timeframe = '1Day';
const KINDS = new Set(['technical', 'overall', 'news', 'options']);

type Outcome = {
    status: string;
    result?: unknown;
    /** Machine-readable code sitting at the top level in several core error
     * variants (e.g. `{status:'no_chains_error', code:'no_options_chains', error: string}`,
     * `{status:'key_error', code:'user_api_key_required', error: string}`) —
     * distinct from `error.code`, which only exists when `error` is itself
     * an object (e.g. `{status:'error', error: AnalysisLimitError}`). */
    code?: string;
    error?: unknown;
};

/** Extracts `error.code` when `error` is a structured object; `undefined` otherwise (e.g. `error` is a plain string). */
function errorObjectCode(outcome: Outcome): string | undefined {
    const err = outcome.error;
    if (typeof err !== 'object' || err === null) return undefined;
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
}

/** Projects an `OverallAnalysisResponse` to the same fields `get_cached_analysis` returns. */
function projectOverall(a: OverallAnalysisResponse) {
    return {
        headline: a.headlineKo,
        technical: a.technicalBulletsKo,
        fundamental: a.fundamentalBulletsKo,
        news: a.newsBulletsKo,
        options: a.optionsBulletsKo,
        conclusion: a.integratedConclusionKo,
        scenarios: a.scenarios,
        risks: a.riskFactorsKo,
    };
}

/** The model reads a handful of top signals — no reason to ship dozens of near-duplicate one-liners. */
const MAX_OPTIONS_SIGNALS = 10;

/**
 * Projects an `OptionsAnalysisResponse`. Unlike news, options has no cap on
 * `perExpiration` anywhere in core's normalizer — requesting `'all'`
 * expirations on a weekly-heavy ticker (PLTR, NVDA) can carry 15-20+ entries
 * of Korean commentary, which alone overflows `CACHED_ANALYSIS_MAX_CHARS`
 * before `signals` is even counted. `perExpiration` goes through
 * `fitProse`'s list path (drops trailing expirations whole, earliest
 * survive); `signals` gets a flat cap since it's already short one-liners.
 */
function projectOptions(a: OptionsAnalysisResponse) {
    return {
        summary: a.summary,
        signals: [...a.signals].slice(0, MAX_OPTIONS_SIGNALS),
        perExpiration: [...a.perExpiration],
    };
}

/**
 * 캐시 히트의 생성 시각을 **투영 전 원본**에서 읽는다 — 단, 그 값을 믿을 수 있는
 * kind에서만.
 *
 * 투영(`projectTechnicalAnalysis`/`projectOverall`/`projectOptions`)은 토큰 예산
 * 때문에 `analyzedAt`을 버리므로, 투영 결과에서 찾으면 항상 `null`이 된다. 그래서
 * 원본을 본다.
 *
 * kind마다 사정이 다르다(core 소스 확인):
 * - `technical` — `filterAnalysisResult`가 `analyzedAt`을 그대로 복사한다. **신뢰 가능.**
 * - `overall` — `normalizeOverallAnalysisResponse`가 캐시 항목의 값을 그대로
 *   통과시킨다(`analyzedAt`이 없던 옛 항목은 생략). **신뢰 가능.**
 * - `options` — `runOptionsAnalysis`가 캐시 항목을
 *   `normalizeOptionsAnalysisResponse(cached, occurredAt)`로 다시 정규화하는데,
 *   그 함수는 `analyzedAt`을 **조회 시각으로 덮어쓴다**(자체 JSDoc: "any value
 *   supplied in `raw` is intentionally ignored"). 즉 캐시 히트인데 지금 시각이
 *   찍힌다 — 이 함수가 없애려는 바로 그 왜곡이라 **읽지 않는다.**
 * - `news` — `NewsAnalysisResponse`에 `analyzedAt` 필드 자체가 없다. 읽을 게 없다.
 *
 * 신뢰할 수 없는 kind는 `null`을 준다. 모르는 것을 모른다고 말하는 편이, 지금
 * 시각을 생성 시각인 척 넘기는 것보다 낫다.
 */
const GENERATED_AT_TRUSTWORTHY_KINDS: ReadonlySet<string> = new Set([
    'technical',
    'overall',
]);

function resolveGeneratedAt(kind: string, raw: unknown): string | null {
    if (!GENERATED_AT_TRUSTWORTHY_KINDS.has(kind)) return null;
    if (typeof raw !== 'object' || raw === null) return null;
    const analyzedAt = (raw as { analyzedAt?: unknown }).analyzedAt;
    return typeof analyzedAt === 'string' && analyzedAt !== ''
        ? analyzedAt
        : null;
}

/**
 * `outcome.status`를 그대로 실어 보낸다.
 *
 * core는 캐시 창(1Day 기준 KST 05:00 경계 또는 24h) 안이면 새로 만들지 않고
 * `status:'cached'`를 돌려준다. 그걸 전부 `source:'fresh'` + `generatedAt: now` +
 * `stale:false`로 찍으면 **몇 시간 전 분석을 방금 만든 것처럼** 보고하게 된다.
 *
 * 이게 특히 나쁜 이유: 시스템 프롬프트는 `get_cached_analysis`가 `stale:true`를
 * 돌려줬을 때 모델을 이 툴로 보낸다. 그런데 같은 저장 분석이 `stale:false`로
 * 되돌아오면, 모델은 자기가 방금 갱신했다고 믿고 그 값을 단정적으로 말한다.
 *
 * 그래서 `cached`일 때는 **모르는 것을 모른다고 말한다**:
 * - `source: 'cached'`
 * - `generatedAt`: 원본에 `analyzedAt`이 있으면 그 값, 없으면 `null`
 * - `stale`: `null` — 여기서는 판정하지 않는다. 봉 기준 staleness는
 *   `get_cached_analysis`의 `isStaleByBars`가 담당하고, 그 계산을 이 경로에서
 *   중복하면 두 툴이 다른 답을 낼 수 있다.
 *
 * 필드를 생략하지 않고 `null`로 내보내는 이유는 `get_cached_analysis`와 **모양을
 * 맞추기 위해서**다 — core의 툴 설명이 "결과 구조가 같다"고 명시한다.
 */
function buildFreshResult(
    kind: string,
    timeframe: Timeframe | undefined,
    analysis: Record<string, unknown>,
    prose: Record<string, ProseSpec>,
    cached: boolean,
    raw: unknown
): unknown {
    const envelope = {
        found: true,
        // 캐시 히트를 'fresh'로 위장하지 않는다 — 모델이 "방금 분석했다"고 말하는
        // 근거가 이 필드다.
        source: cached ? 'cached' : 'fresh',
        tab: kind,
        ...(timeframe ? { timeframe } : {}),
        generatedAt: cached
            ? resolveGeneratedAt(kind, raw)
            : new Date().toISOString(),
        stale: cached ? null : false,
        analysis,
    };
    if (Object.keys(prose).length === 0) return envelope;
    const fitted = fitProse(envelope, prose);
    return { ...envelope, analysis: { ...analysis, ...fitted } };
}

function unwrap(
    kind: string,
    timeframe: Timeframe | undefined,
    outcome: Outcome
): unknown {
    if (
        (outcome.status === 'done' || outcome.status === 'cached') &&
        outcome.result !== undefined
    ) {
        const cached = outcome.status === 'cached';
        if (kind === 'technical') {
            const projected = projectTechnicalAnalysis(
                outcome.result as AnalysisResponse
            );
            // Budget-fit via the SAME shared helper `get_cached_analysis`
            // uses for its Redis peek path (`fitTechnicalAnalysis`), so an
            // oversized technical payload is protected identically
            // regardless of which tool produced it. `buildFreshResult` here
            // only assembles the raw envelope (empty `prose` skips its own
            // generic fit); the technical-specific fit runs after.
            const envelope = buildFreshResult(
                kind,
                timeframe,
                projected,
                {},
                cached,
                outcome.result
            );
            // Safe: `buildFreshResult` returns `{ ...envelope, analysis }`
            // untouched (bar the `unknown`-typed signature) whenever `prose`
            // is `{}` — see its `if (Object.keys(prose).length === 0) return
            // envelope` branch just above, taken here. So `envelope.analysis`
            // really is `projected` (a `ProjectedTechnicalAnalysis`), and this
            // cast just recovers the type erased by that shared function's
            // loose `unknown` return type.
            return fitTechnicalAnalysis(
                envelope as { analysis: typeof projected }
            );
        }
        if (kind === 'overall') {
            const projected = projectOverall(
                outcome.result as OverallAnalysisResponse
            );
            return buildFreshResult(
                kind,
                timeframe,
                projected,
                {
                    headline: { kind: 'text', value: projected.headline },
                    conclusion: { kind: 'text', value: projected.conclusion },
                    technical: { kind: 'list', value: projected.technical },
                    fundamental: { kind: 'list', value: projected.fundamental },
                    news: { kind: 'list', value: projected.news },
                    options: { kind: 'list', value: projected.options },
                    risks: { kind: 'list', value: projected.risks },
                },
                cached,
                outcome.result
            );
        }
        if (kind === 'options') {
            const projected = projectOptions(
                outcome.result as OptionsAnalysisResponse
            );
            return buildFreshResult(
                kind,
                timeframe,
                projected,
                {
                    summary: { kind: 'text', value: projected.summary },
                    perExpiration: {
                        kind: 'list',
                        value: projected.perExpiration,
                    },
                },
                cached,
                outcome.result
            );
        }
        // `news` is already small and bounded (a handful of short bullet
        // arrays) — no projection/budget needed.
        return buildFreshResult(
            kind,
            timeframe,
            outcome.result as Record<string, unknown>,
            {},
            cached,
            outcome.result
        );
    }
    return {
        error: 'analysis_failed',
        code: errorObjectCode(outcome) ?? outcome.code ?? outcome.status,
    };
}

/**
 * Runs a NEW analysis through the same entry points as the analysis stream
 * route. Deliberately does NOT forward `ctx.signal`: core `dedupeInFlight`
 * shares one in-flight analysis promise across every caller keyed on the
 * same cache key (prewarm, symbol-page viewers, other agent turns) — if this
 * tool forwarded the turn's own abort signal, cancelling one agent turn
 * would kill that shared analysis for everyone else awaiting it. A per-
 * instance semaphore bounds concurrency instead, and the slot is registered
 * with `registerActiveStream()` so a deploy drain waits for it like any
 * other in-flight analysis stream.
 */
export const runFreshAnalysisTool: ToolExecutor = async (
    args,
    ctx,
    runtime
) => {
    const symbol =
        typeof args.symbol === 'string' ? args.symbol.toUpperCase() : '';
    const kind = typeof args.kind === 'string' ? args.kind : '';
    // Validated before the slot is acquired: an invalid symbol/kind must
    // never consume a semaphore unit or an activeStreams slot.
    if (!isAdmissibleSymbolShape(symbol))
        return {
            error: 'invalid_args',
            issues: [{ path: 'symbol', message: 'invalid symbol' }],
        };
    if (!KINDS.has(kind))
        return {
            error: 'invalid_args',
            issues: [{ path: 'kind', message: 'unknown kind' }],
        };

    if (inFlight >= MAX_CONCURRENT_FRESH) {
        // Alarm marker (infra/aws/07-alarms.sh `siglens-agent-busy`): a busy
        // refusal means this instance is at capacity — the operator wants to
        // hear about it, not find it in a user's complaint.
        console.warn(AGENT_BUSY_LOG, {
            reason: 'fresh_analysis_slots',
            inFlight,
            cap: MAX_CONCURRENT_FRESH,
        });
        return { error: 'busy', retryAfterSeconds: 60 };
    }
    inFlight += 1;
    const release = registerActiveStream();
    try {
        /*
         * 뉴스 축을 입력으로 쓰는 kind만 수급한다. `technical`·`options`는 DB의
         * 뉴스를 아예 읽지 않으므로 적재해도 답이 한 글자도 안 바뀐다.
         *
         * **이 게이트가 의미를 갖는 전제는 `ensureSymbolNewsFresh`가 신규 기사를
         * 동기로 보강한다는 것이다.** `news`·`overall` 축은
         * `buildAnalysisNewsItems`의 `isEnrichedRow`가 미보강 행을 전부 걸러내므로,
         * 적재만 하고 보강을 백그라운드로 미루면 방금 넣은 기사가 이번 분석에 한
         * 건도 안 들어간다 — 그 시절엔 이 호출이 슬롯을 쥔 채 왕복만 얹는 순비용이라
         * 아예 빼 뒀었다. 동기 보강으로 바뀌면서 근거가 뒤집혔다.
         *
         * 위치가 중요하다 — 인자 검증(`KINDS`)과 슬롯 포화(`busy`) 거절 **뒤**다.
         * 앞에 두면 그 값싼 거절들이 FMP 왕복과 Neon upsert를 먼저 지불한다.
         *
         * 받아들인 트레이드오프: 이 await는 `MAX_CONCURRENT_FRESH` 슬롯과
         * `registerActiveStream()` 드레인 핸들을 **쥔 채로** 돈다. 그래서 수급이
         * 느리면 그만큼 다른 요청의 슬롯이 늦게 난다. 대안(슬롯 밖에서 먼저 수급)은
         * 위 문단의 이유로 못 쓴다 — 포화 거절이 수급 비용을 먼저 내게 된다.
         * 대신 수급 쪽이 스스로 바운드를 든다 — `ensureSymbolNewsFresh`는 바깥
         * 세계로 나가는 두 대기(FMP 적재·LLM 보강)에 벽시계 예산을 걸어 그 둘의
         * 합을 18초로 묶는다(`INGEST_BUDGET_MS` 주석). 전체 상한은 거기에
         * `isRecentlyFetched`(Redis)와 `listBySymbol`(Neon) 왕복이 더해진
         * 값이다 — 그 둘은 재시도 사다리가 없어 꼬리가 짧지만 0은 아니다.
         *
         * 이게 유일한 실질 바운드다: 이 툴의 `costClass: 'expensive'`
         * 타임아웃(300초)은 core의 `withTimeout`, 즉 `Promise.race`라 **취소가
         * 아니라 포기**여서 슬롯도 드레인 핸들도 놓아주지 않는다.
         *
         * 열화 꼬리를 받아들인다: 적재가 예산을 넘기면 게이트는 아무것도 보강하지
         * 못한 채 `deferred`로 돌아오고, 그러면 `isEnrichedRow`가 방금 들어온 행을
         * 전부 걸러내 **이번 분석은 새 기사 없이 만들어져 24시간 캐시된다.** 즉
         * 이 호출은 8초를 내고 얻는 게 없다. 그래도 이 await를 두는 이유는 그게
         * 예외적 꼬리이기 때문이다 — 해피 패스(실측 3.2초)에서는 새 기사가 그
         * 분석에 들어가고, 넘어간 적재도 `after()`가 이어받아 다음 호출부터는
         * 반영된다. 적재가 상시 8초를 넘기는 상태라면 그건 이 게이트가 아니라
         * FMP 쪽 문제다.
         */
        if (kind === 'news' || kind === 'overall') {
            await runtime.ensureSymbolData(symbol);
        }
        const timeframe =
            (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;
        const [profile, asset] = await Promise.all([
            resolveMarketProfile(symbol),
            resolveAssetInfoOrNull(symbol, 'run_fresh_analysis'),
        ]);
        const companyName = asset?.name ?? symbol;
        const descriptor = getDescriptor(profile);
        switch (kind) {
            case 'technical': {
                const options: SubmitAnalysisOptions = {
                    modelId: runtime.analysisModel,
                    marketDataProvider: getCachedMarketDataProvider(
                        sessionSpecFor(profile)
                    ),
                    assetClass: descriptor.assetClass,
                    currency: descriptor.priceFormat.currency,
                    tierContext: { userId: ctx.userId, tier: ctx.tier },
                    reasoning: false,
                    locale: ctx.locale,
                    skipEnqueueIfMiss: false,
                    // ai.siglens.io has no model picker: a DeepSeek outage retries once on Gemini (core 1.7.0).
                    providerFallback: true,
                };
                return unwrap(
                    kind,
                    timeframe,
                    (await runAnalysis(
                        symbol,
                        companyName,
                        timeframe,
                        false,
                        asset?.fmpSymbol,
                        options
                    )) as Outcome
                );
            }
            // overall/news/options go through server actions shared with siglens.io's
            // user-chosen model paths, which must not fall back — no providerFallback there.
            case 'overall':
                return unwrap(
                    kind,
                    timeframe,
                    (await runOverallAnalysisAction(
                        symbol,
                        companyName,
                        timeframe,
                        runtime.analysisModel,
                        ctx.locale,
                        { reasoning: false }
                    )) as Outcome
                );
            case 'news':
                return unwrap(
                    kind,
                    undefined,
                    (await submitNewsAnalysisAction(
                        symbol,
                        companyName,
                        runtime.analysisModel,
                        ctx.locale,
                        false
                    )) as Outcome
                );
            case 'options':
                return unwrap(
                    kind,
                    undefined,
                    (await submitOptionsAnalysisAction(
                        symbol,
                        companyName,
                        'all',
                        runtime.analysisModel,
                        ctx.locale,
                        false
                    )) as Outcome
                );
            default:
                // Unreachable — `KINDS.has(kind)` already narrowed above.
                return {
                    error: 'invalid_args',
                    issues: [{ path: 'kind', message: 'unknown kind' }],
                };
        }
    } finally {
        inFlight -= 1;
        release();
    }
};
