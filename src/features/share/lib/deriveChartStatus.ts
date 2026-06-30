import type { ShareableStatus } from '../model/ShareableAnalysisContext';

export interface DeriveChartStatusInput {
    isAnalyzing: boolean;
    analysisError: boolean;
    isBotBlocked: boolean;
    hasResult: boolean;
}

/**
 * Derives a `ShareableStatus` from the chart widget's boolean state flags,
 * applying a fixed priority order:
 *
 * 1. botBlocked  → 'unavailable'
 * 2. isAnalyzing → 'pending'
 * 3. analysisError → 'error'
 * 4. hasResult   → 'success'
 * 5. (else)      → 'idle'
 */
export function deriveChartStatus({
    isAnalyzing,
    analysisError,
    isBotBlocked,
    hasResult,
}: DeriveChartStatusInput): ShareableStatus {
    if (isBotBlocked) return 'unavailable';
    if (isAnalyzing) return 'pending';
    if (analysisError) return 'error';
    if (hasResult) return 'success';
    return 'idle';
}
