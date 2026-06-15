import fixture from '@e2e/fixtures/analysis.json';
import type {
    AnalysisResponse,
    FundamentalAnalysisResponse,
    NewsAnalysisResponse,
    OptionsAnalysisResponse,
    OverallAnalysisResponse,
    SubmitAnalysisGatedResult,
    SubmitFundamentalAnalysisCached,
    SubmitNewsAnalysisCached,
    SubmitOptionsAnalysisCached,
    SubmitOptionsAnalysisNoChainsError,
} from '@y0ngha/siglens-core';
export { isE2E } from './e2eEnv';

/**
 * The fixture is authored by hand to match each core `*AnalysisResponse` shape.
 * This typed view re-narrows the imported JSON to the exact core response types
 * so the per-type getters below return the correct discriminated cached-result
 * union without per-field casts.
 *
 * Why an `as` assertion and NOT a plain type annotation: with
 * `resolveJsonModule`, TS infers every JSON string value at its WIDENED type
 * (`trend: string`, not `'neutral'`), even though the literal is a valid member
 * of the core union (`Trend = 'bullish' | 'bearish' | 'neutral'`). A type
 * annotation (`const x: {...} = fixture`) — or `satisfies`, or a per-field
 * annotation — therefore fails to compile (`string` not assignable to `Trend`)
 * for ANY fixture content, so it cannot be used here. The single assertion only
 * erases that JSON literal-widening; structural drift (a missing/renamed
 * required field, or a wrong-typed field) is still caught at compile time
 * because the assertion target is the real core interface set.
 */
interface E2eAnalysisFixture {
    technical: AnalysisResponse;
    overall: Omit<OverallAnalysisResponse, 'financialsBulletsKo'>;
    fundamental: FundamentalAnalysisResponse;
    news: NewsAnalysisResponse;
    options: OptionsAnalysisResponse;
}
const typedFixture = fixture as E2eAnalysisFixture;

/** Fixed `{ status: 'cached' }` technical analysis result for E2E runs. */
export function e2eCachedTechnical(): SubmitAnalysisGatedResult {
    return { status: 'cached', result: typedFixture.technical };
}

/** Fixed `{ status: 'cached' }` overall analysis result for E2E runs. */
export function e2eCachedOverall(): {
    status: 'cached';
    result: Omit<OverallAnalysisResponse, 'financialsBulletsKo'>;
} {
    return { status: 'cached', result: typedFixture.overall };
}

/** Fixed `{ status: 'cached' }` fundamental analysis result for E2E runs. */
export function e2eCachedFundamental(): SubmitFundamentalAnalysisCached {
    return { status: 'cached', result: typedFixture.fundamental };
}

/** Fixed `{ status: 'cached' }` news analysis result for E2E runs. */
export function e2eCachedNews(): SubmitNewsAnalysisCached {
    return { status: 'cached', result: typedFixture.news };
}

/** Fixed `{ status: 'cached' }` options analysis result for E2E runs. */
export function e2eCachedOptions(): SubmitOptionsAnalysisCached {
    return { status: 'cached', result: typedFixture.options };
}

/**
 * Cookie name an E2E test sets to force the next options-analysis submit to
 * return a transient failure instead of the cached fixture. Read server-side by
 * `submitOptionsAnalysisAction` (only under `E2E_TEST=1`). The resilience spec
 * sets it, asserts the error fallback, then clears it so the retry recovers.
 * The e2e spec imports this constant directly; the only literal copy is the
 * vi.mock factory in optionsActions.test.ts (hoisted before imports) — keep that
 * one in sync if this value changes.
 */
export const E2E_FORCE_ANALYSIS_ERROR_COOKIE = 'e2e_force_analysis_error';

/**
 * Deterministic transient-failure result for E2E resilience tests. Returned by
 * the options submit action (under E2E_TEST) when the force-error cookie is
 * present, so `useOptionsAnalysis` throws and surfaces OptionsAiAnalysisError
 * ("다시 시도"). Reuses the real `no_chains_error` variant — any error-producing
 * status drives the same error boundary, and this one needs no jobId/poll.
 */
export function e2eForcedOptionsError(): SubmitOptionsAnalysisNoChainsError {
    return {
        status: 'no_chains_error',
        code: 'no_options_chains',
        error: 'E2E 강제 분석 실패 (resilience 테스트용)',
    };
}
