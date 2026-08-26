// news widget barrel — public API for external consumers.

export { NewsFactsSummary } from './NewsFactsSummary';
export type { NewsFactsSummaryProps } from './NewsFactsSummary';
export { NewsAiSummary, NewsAiSummaryView } from './NewsAiSummary';
export { NewsAiSummaryError } from './NewsAiSummaryError';
export { NewsAiSummaryErrorBoundary } from './NewsAiSummaryErrorBoundary';
export { NewsListErrorBoundary } from './NewsListErrorBoundary';
export { NewsAiSummarySkeleton } from './NewsAiSummarySkeleton';

// /overall 등 다른 widget이 동일 게이트(개별 카드 분석 후 종합 trigger)를 재사용할 수
// 있도록 공유 클라이언트 훅을 barrel로 노출한다. 모두 'use client' 모듈이라 server-only
// 의존성이 없으므로 barrel 제외 사유 없음.
export { useNewsAnalysisTrigger } from './hooks/useNewsAnalysisTrigger';
export { useWaitForNewsCards } from './hooks/useWaitForNewsCards';

// 서버 섹션이 클라이언트로 넘길 행 수를 자를 때 쓴다 — 근거는 constants.ts 주석.
export { NEWS_ROW_SERIALIZATION_LIMIT } from './constants';
