import type { ShareableStatus } from '../model/ShareableAnalysisContext';

export interface DeriveChartStatusInput {
    isAnalyzing: boolean;
    analysisError: boolean;
    hasResult: boolean;
}

/**
 * Derives a `ShareableStatus` from the chart widget's boolean state flags,
 * applying a fixed priority order:
 *
 * 1. isAnalyzing → 'pending'
 * 2. analysisError → 'error'
 * 3. hasResult   → 'success'
 * 4. (else)      → 'idle'
 */
export function deriveChartStatus({
    isAnalyzing,
    analysisError,
    hasResult,
}: DeriveChartStatusInput): ShareableStatus {
    if (isAnalyzing) return 'pending';
    if (analysisError) return 'error';
    if (hasResult) return 'success';
    return 'idle';
}
