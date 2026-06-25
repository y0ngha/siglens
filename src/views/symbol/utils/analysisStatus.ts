export type AnalysisStatus =
    | { type: 'idle' }
    | { type: 'analyzing' }
    | { type: 'error'; message: string };

export function getAnalysisStatus(
    isAnalyzing: boolean,
    analysisError: string | null
): AnalysisStatus {
    if (isAnalyzing) return { type: 'analyzing' };
    if (analysisError !== null)
        return { type: 'error', message: analysisError };
    return { type: 'idle' };
}
