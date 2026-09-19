/**
 * Shared anchors for the analysis E2E specs.
 *
 * `ANALYSIS_FIXTURE_SUMMARY_PREFIX` is the stable literal that prefixes every
 * `summary`/headline in `e2e/fixtures/analysis.json`. Specs assert on it to
 * prove the deterministic cached fixture (not a placeholder or real LLM output)
 * drove the render. Kept here so `analysis-jobs.spec.ts` and
 * `symbol-analysis.spec.ts` share one source of truth instead of duplicating
 * the literal (which would silently drift if the fixture text changed).
 */
export const ANALYSIS_FIXTURE_SUMMARY_PREFIX = 'E2E 고정 분석 결과';

/**
 * Upper bound for the cached fixture analysis to surface in the DOM. The
 * progress-finishing animation (~9s of real `setTimeout`s — the specs do NOT
 * freeze the clock) gates the `summary`/headline render, so specs wait this
 * long before asserting visibility. Shared so `symbol-analysis.spec.ts` and
 * `analysis-jobs.spec.ts` use one source of truth instead of each redefining
 * the literal.
 */
export const ANALYSIS_RENDER_TIMEOUT_MS = 20_000;
