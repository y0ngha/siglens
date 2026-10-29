/**
 * 분석 진행·오류 표시 상태 판정.
 */
/** 분석 패널의 진행·오류 상태. */
export type AnalysisStatus =
    | { type: 'idle' }
    | { type: 'analyzing' }
    | { type: 'error'; message: string };

/** 진행 중이 오류보다 우선한다. */
export function getAnalysisStatus(
    isAnalyzing: boolean,
    analysisError: string | null
): AnalysisStatus {
    if (isAnalyzing) return { type: 'analyzing' };
    if (analysisError !== null)
        return { type: 'error', message: analysisError };
    return { type: 'idle' };
}
