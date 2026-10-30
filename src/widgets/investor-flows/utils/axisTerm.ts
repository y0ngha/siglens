/**
 * 점수표 축 제목 옆에 붙는 용어 풀이(툴팁) 선택.
 */
import type {
    InvestorFlowsAxisId,
    InvestorFlowsMarket,
} from '@y0ngha/siglens-core';
import type { FlowTerm } from '../investorFlowsTooltips';

/** 축 제목 옆 용어 풀이. */
const AXIS_TERM: Record<InvestorFlowsAxisId, FlowTerm> = {
    institutional: 'institutionalHolding',
    insider: 'form4',
    largeHolders: 'largeHolder13dg',
    short: 'shortInterest',
    dilution: 'dilution',
};

/** 한국 점수표의 축 풀이 — DART 대량보유·임원·주요주주 소유보고(13D/G·Form 4가 아니다). */
const KR_AXIS_TERM: Partial<Record<InvestorFlowsAxisId, FlowTerm>> = {
    insider: 'krInsider',
    largeHolders: 'krMajorHolder',
};

/** 한국 점수표에서 한국 전용 풀이가 있는 축은 그것을, 나머지는 시장 공통 풀이를 쓴다. */
export function axisTerm(
    axis: InvestorFlowsAxisId,
    market: InvestorFlowsMarket
): FlowTerm {
    return (
        (market === 'kr' ? KR_AXIS_TERM[axis] : undefined) ?? AXIS_TERM[axis]
    );
}

/** 종합 점수 제목 옆 풀이 — 시장마다 점수의 뜻이 다르다. */
export const COMPOSITE_TERM: Record<InvestorFlowsMarket, FlowTerm> = {
    us: 'flowScore',
    kr: 'krFlowScore',
};
