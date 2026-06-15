import type { FinancialsAxis } from '@y0ngha/siglens-core';

/**
 * Korean labels for the four financials scorecard axes.
 * Single source shared by FinancialsScorecard (축 카드 제목) and
 * FinancialsAiSummary (축별 평가 라벨) so the two stay in sync.
 *
 * 성장성/수익성·질/안정성/현금창출력 — matches the product requirements.
 */
export const AXIS_LABEL_KO: Record<FinancialsAxis, string> = {
    growth: '성장성',
    quality: '수익성·질',
    solvency: '안정성',
    cash: '현금창출력',
};
