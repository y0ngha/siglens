import type { MarketSummaryData } from '@y0ngha/siglens-core';

/**
 * E2E force-partial-failure cookie for `/market`. When present (under E2E_TEST),
 * `getMarketSummaryAction` zeroes a subset of quotes so the "데이터 일부 로드 실패"
 * 안내가 결정적으로 렌더된다. Mirrors the force-error cookie pattern in
 * e2eAnalysisStub (`E2E_FORCE_ANALYSIS_ERROR_COOKIE`). The market spec imports
 * this constant directly — keep any test-side literal copy in sync.
 */
export const E2E_FORCE_MARKET_PARTIAL_COOKIE = 'e2e_force_market_partial';

/**
 * Return a copy of the summary with the first sector's quote zeroed
 * (price/change = 0). 0 is the same fetch-failure signal the real provider
 * emits on a per-symbol failure, so this exercises the production detection path
 * (`hasMissingQuotes`) end-to-end without touching FMP. Indices stay intact so
 * the page still renders most cards alongside the notice.
 */
export function e2eForceMarketPartial(
    summary: MarketSummaryData
): MarketSummaryData {
    return {
        indices: summary.indices,
        sectors: summary.sectors.map((s, i) =>
            i === 0 ? { ...s, price: 0, changesPercentage: 0 } : s
        ),
    };
}
