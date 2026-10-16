import type { InvestorFlowsAxisId } from '@y0ngha/siglens-core';

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
