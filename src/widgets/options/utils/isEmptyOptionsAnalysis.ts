import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

/**
 * Whether an analysis carries nothing renderable (no summary, no per-expiry
 * commentary, no signals) and should show the error card instead.
 */
export function isEmptyOptionsAnalysis(
    result: OptionsAnalysisResponse
): boolean {
    return (
        result.summary === '' &&
        result.perExpiration.length === 0 &&
        result.signals.length === 0
    );
}
