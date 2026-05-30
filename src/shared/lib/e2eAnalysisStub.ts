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
    SubmitOverallAnalysisCached,
} from '@y0ngha/siglens-core';
import fixture from '@e2e/fixtures/analysis.json';

/**
 * E2E test-mode guard. Server-side actions short-circuit their analysis
 * submit path to a fixed cached result only when this returns `true`, so the
 * Playwright suite never reaches the real worker / LLM. Mirrors the
 * `E2E_TEST === '1'` gate already used by `getMarketDataProvider` and the db
 * client.
 */
export function isE2E(): boolean {
    return process.env.E2E_TEST === '1';
}

/**
 * The fixture is authored by hand to match each core `*AnalysisResponse`
 * shape, but JSON literal types widen on import (e.g. `trend: string` instead
 * of `Trend`, array tones as `string`). This typed view re-narrows the fixture
 * to the exact core response types so the per-type getters below return the
 * correct discriminated cached-result union without per-field casts.
 *
 * Guarantee: every value in `e2e/fixtures/analysis.json` is a literal drawn
 * from the corresponding core union (`'neutral'`, `'medium'`, `'cached'`-side
 * shapes, etc.) and every required field is present — verified by the keys in
 * this map matching the response interfaces. The cast only erases JSON literal
 * widening; it does not assert structure that isn't physically in the file.
 */
const typedFixture = fixture as {
    technical: AnalysisResponse;
    overall: OverallAnalysisResponse;
    fundamental: FundamentalAnalysisResponse;
    news: NewsAnalysisResponse;
    options: OptionsAnalysisResponse;
};

/** Fixed `{ status: 'cached' }` technical analysis result for E2E runs. */
export function e2eCachedTechnical(): SubmitAnalysisGatedResult {
    return { status: 'cached', result: typedFixture.technical };
}

/** Fixed `{ status: 'cached' }` overall analysis result for E2E runs. */
export function e2eCachedOverall(): SubmitOverallAnalysisCached {
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
