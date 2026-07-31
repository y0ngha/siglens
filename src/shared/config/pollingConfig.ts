import { MS_PER_MINUTE } from '@/shared/config/time';

// 분석 잡 폴링 간격 모음 — 분석 종류별로 워커 작업 시간/캐시 히트 빈도가 달라 의도적으로 다른 값을 사용한다.
// 폴링마다 서버 액션(함수)을 호출해 Fast Origin Transfer + Function Invocation을 유발하므로,
// 분석이 수십 초 걸리는 작업 특성에 맞춰 간격을 넉넉히 잡아 폴링 횟수(=비용)를 줄인다.
// 트레이드오프: 완료 감지가 간격만큼 늦어질 수 있다(평균 간격/2).

/** Fundamental, News, Options 페이지 분석 폴링 (LLM 호출 1회). */
export const ANALYSIS_POLL_INTERVAL_MS = 10000;

/** 차트 페이지 augment + Overall 의존성 폴링 — 캐시 적중률이 높아 느린 간격으로 충분. */
export const AUGMENT_AND_OVERALL_POLL_INTERVAL_MS = 5000;

/** 차트 페이지 메인 분석 — 워커가 다단계 작업을 수행해 길게 잡는다. */
export const CHART_ANALYSIS_POLL_INTERVAL_MS = 30000;

// Card polling — snapshot fetch while waiting for LLM enrichment.
// Separate from analysis poll intervals above: card polling is frequent (3 s)
// because it checks incremental DB writes, not a long-running worker job.

/** Card polling — interval between snapshot fetches while waiting for LLM enrichment. */
export const NEWS_CARD_POLL_INTERVAL_MS = 3_000;

/** Card polling — bail after N consecutive errors. */
export const NEWS_CARD_MAX_CONSECUTIVE_FAILURES = 3;

/** Card polling — bail if snapshot is empty after N total successful polls. */
export const NEWS_CARD_EMPTY_SNAPSHOT_MAX_POLLS = 20;

/** Card polling — overall hard ceiling. */
export const NEWS_CARD_MAX_POLL_DURATION_MS = 5 * MS_PER_MINUTE;

/**
 * Analysis job polling — hard ceiling for a single continuous poll loop,
 * shared across long-running LLM jobs (Congress, Financials, etc.). If the
 * worker stalls in `processing` for longer than this, the poll loop breaks
 * and surfaces an error so the user can retry rather than seeing an infinite
 * skeleton.
 *
 * This is a per-loop budget, not a per-hook-lifetime one — a flow with
 * multiple SEQUENTIAL poll loops must re-arm it (capture a fresh
 * `Date.now()` baseline) for each loop rather than sharing one clock across
 * all of them. `useOverallAnalysis` is the one caller with two such loops
 * (waiting on axis dependencies, then polling its own final job) — see
 * `fetchOverallAnalysis` in `widgets/overall/hooks/useOverallAnalysis.ts`.
 * Without re-arming, a slow-but-healthy dependency phase can eat the whole
 * budget and turn a real, in-flight final job into an immediate, spurious
 * timeout that also orphans the worker job (nothing cancels it once the hook
 * has already surfaced the error).
 */
export const ANALYSIS_POLL_MAX_DURATION_MS = 5 * MS_PER_MINUTE;

/**
 * User-facing error message surfaced when a poll loop exceeds
 * {@link ANALYSIS_POLL_MAX_DURATION_MS}. Shared by exactly the six analysis
 * poll hooks that use this literal string — chart, financials, fundamental,
 * news, options, and overall — so the message stays identical across all of
 * them and isn't re-typed (and re-drifted) at each call site.
 *
 * `useCongressTrend.ts` and `useMacroBriefingPoll.ts` also poll against
 * {@link ANALYSIS_POLL_MAX_DURATION_MS} but are deliberately NOT on this
 * list: congress throws its own domain-specific `Error` message, and
 * macro-briefing surfaces a `'poll_timeout'` error code (not a message
 * string) so the widget can render its own inline copy. Do not widen this
 * JSDoc's hook list without also switching those two call sites to import
 * and use this constant.
 */
export const ANALYSIS_POLL_TIMEOUT_MESSAGE =
    '분석이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.';
