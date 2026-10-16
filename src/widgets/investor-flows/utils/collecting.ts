import type { InvestorFlowsAxisId } from '@y0ngha/siglens-core';
import type { CollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';

/** 점수 카드에서 "데이터 부족" 대신 "수집 중"으로 표시할 축. */
export function collectingAxes(state: CollectingArms): InvestorFlowsAxisId[] {
    return [
        ...(state.institutional ? (['institutional'] as const) : []),
        ...(state.short ? (['short'] as const) : []),
    ];
}
