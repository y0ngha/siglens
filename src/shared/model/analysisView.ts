'use client';

import { usePersistentState } from '@/shared/hooks/usePersistentState';

/** 쉽게보기 / 원본보기. */
export type AnalysisViewMode = 'plain' | 'raw';

/**
 * 표시 모드 저장 키.
 *
 * **전역 하나만 둔다.** 종목 페이지의 최상위 탭이 9개이므로 탭별 상태를 두면
 * 사용자가 같은 선택을 아홉 번 해야 하고, "이 탭은 쉽게인데 저 탭은 원본"인 상태가
 * 버그로 보인다. 쉽게/원본은 페이지 속성이 아니라 읽는 사람의 성향이다.
 */
export const ANALYSIS_VIEW_STORAGE_KEY = 'siglens:analysis-view';

/** 기본값은 쉽게보기다. */
export const DEFAULT_ANALYSIS_VIEW: AnalysisViewMode = 'plain';

/**
 * 표시 모드 훅.
 *
 * `usePersistentState`는 `useSyncExternalStore` 기반이라 같은 key를 쓰는 인스턴스가
 * 자동으로 함께 갱신된다 — 데스크톱 패널과 `MobileAnalysisSheet`가 동시에 마운트되는
 * 구조라 이 성질이 필요하다. 다른 탭의 변경도 반영된다.
 */
export function useAnalysisView(): [
    AnalysisViewMode,
    (mode: AnalysisViewMode) => void,
] {
    const [mode, setMode] = usePersistentState<AnalysisViewMode>(
        ANALYSIS_VIEW_STORAGE_KEY,
        DEFAULT_ANALYSIS_VIEW
    );
    return [mode === 'raw' ? 'raw' : 'plain', setMode];
}
