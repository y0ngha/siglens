/**
 * `ChartContent`가 AI 패널에 넘기는 진행·오류 상태. 플래그 두 개 대신 판별 유니온 하나로 넘겨
 * "진행 중이면서 오류" 같은 조합이 패널에 닿지 않게 한다.
 */
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
