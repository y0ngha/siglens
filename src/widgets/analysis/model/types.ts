/**
 * 재분석 쿨다운 알림 — 쿨다운 창 내에서 재분석을 시도했을 때
 * useAnalysis가 반환하는 상태. AnalysisPanel / AnalysisToast가
 * 남은 대기 시간을 사용자에게 표시하는 데 사용한다.
 */
export interface CooldownNotice {
    nonce: number;
    remainingMs: number;
}
