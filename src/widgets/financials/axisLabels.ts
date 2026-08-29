import type { FinancialsAxis } from '@y0ngha/siglens-core';

/**
 * FinancialsAxis → `shared.enumLabel.financialsAxis` 카탈로그 키.
 * Single source shared by FinancialsScorecard (축 카드 제목) and
 * FinancialsAiSummary (축별 평가 라벨) so the two stay in sync.
 *
 * 값 자체는 더 이상 한글이 아니다 — `FinancialsSnapshotProse`가 이미 같은
 * 그룹을 쓰고 있었는데(자체 정의), 이쪽 두 소비자만 하드코딩된 한글이 남아
 * `/en/AAPL/financials`가 축 제목만 한국어로 렌더됐다.
 */
export const AXIS_LABEL_KEY: Record<FinancialsAxis, string> = {
    growth: 'financialsAxis.growth',
    quality: 'financialsAxis.quality',
    solvency: 'financialsAxis.solvency',
    cash: 'financialsAxis.cash',
};
