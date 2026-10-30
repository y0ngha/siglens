/**
 * analysis 위젯 내부에서 공유하는 타입 정의.
 */

/**
 * 재분석 쿨다운 알림 — 쿨다운 창 내에서 재분석을 시도했을 때
 * useAnalysis가 반환하는 상태. AnalysisPanel / AnalysisToast가
 * 남은 대기 시간을 사용자에게 표시하는 데 사용한다.
 */
export interface CooldownNotice {
    nonce: number;
    remainingMs: number;
}

/**
 * 카드가 차트 작도를 켜고 끄고 강조하는 데 쓰는 콜백 묶음 — `ChartContent`의
 * `useOverlayItemVisibility` 상태를 그대로 전달한다(차트 메뉴와 같은 상태).
 */
export interface OverlayCardControls {
    hiddenKeys: ReadonlySet<string>;
    onToggle: (key: string) => void;
    /** hover·focus 동안 강조할 key. `null`이면 강조 해제. */
    onHighlight: (key: string | null) => void;
    /** `key`가 강조 중일 때만 해제(멱등) — 언마운트·blur·pointerleave 정리 전용. */
    onClearHighlight: (key: string) => void;
}

/** 리포트 복사 버튼의 표시 상태. */
export type CopyReportState = 'idle' | 'copied' | 'failed';
