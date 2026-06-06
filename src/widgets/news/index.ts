// news widget barrel — public API for external consumers.

export { NewsAiSummary } from './NewsAiSummary';
export { NewsAiSummaryError } from './NewsAiSummaryError';
export { NewsAiSummaryErrorBoundary } from './NewsAiSummaryErrorBoundary';
export { NewsAiSummarySkeleton } from './NewsAiSummarySkeleton';

// /overall 등 다른 widget이 동일 게이트(개별 카드 분석 후 종합 trigger)를 재사용할 수
// 있도록 공유 클라이언트 훅을 barrel로 노출한다. 모두 'use client' 모듈이라 server-only
// 의존성이 없으므로 barrel 제외 사유 없음.
export { useNewsAnalysisTrigger } from './hooks/useNewsAnalysisTrigger';
export { useWaitForNewsCards } from './hooks/useWaitForNewsCards';
