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
