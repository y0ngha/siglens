/**
 * 점수표 축 제목의 카탈로그 키.
 */
import type {
    InvestorFlowsAxisId,
    InvestorFlowsMarket,
} from '@y0ngha/siglens-core';

/**
 * 축 제목 카탈로그 키(`widgets.investor-flows.axis` 네임스페이스 기준 상대 키). 점수 카드와 AI 해석이 같은 말을 쓴다.
 * 소스에 키 리터럴을 남겨 두어야 어느 화면이 어느 문구를 쓰는지 한눈에 보인다.
 */
export const AXIS_TITLE_KEY: Record<InvestorFlowsAxisId, string> = {
    institutional: 'institutional',
    insider: 'insider',
    largeHolders: 'largeHolders',
    short: 'short',
    dilution: 'dilution',
};

/**
 * 시장별 축 제목 키. 한국은 내부자 슬롯이 DART 임원·주요주주 소유보고라 그 이름을 쓴다(core가 KR 평가 결과를 같은 슬롯에 넣는다).
 * 나머지 축은 시장과 무관하다.
 */
export function axisTitleKey(
    axis: InvestorFlowsAxisId,
    market: InvestorFlowsMarket
): string {
    return market === 'kr' && axis === 'insider'
        ? 'krInsider'
        : AXIS_TITLE_KEY[axis];
}
