import type { BacktestAiAnalysis } from '@y0ngha/siglens-core';

/** AI 분석에 표시할 가격 레벨(목표가·손절가·익절가)이 하나라도 있는지. */
export function hasPriceLevels(analysis: BacktestAiAnalysis): boolean {
    return (
        analysis.bullishTargets.length > 0 ||
        analysis.stopLoss !== undefined ||
        analysis.takeProfit !== undefined
    );
}
