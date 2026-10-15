import 'server-only';
import type { InvestorFlowsDataProvider } from '@y0ngha/siglens-core';
import { getInvestorFlowsSnapshot } from './getInvestorFlowsSnapshot';

/**
 * AI 해석(`runInvestorFlowsAnalysis`)이 읽는 포트 — 페이지가 그리는 것과 **같은 캐시 스냅샷**을 돌려준다.
 *
 * 포트를 DB/FMP 구현(`getInvestorFlowsDataProvider`)에 직접 물리면 화면의 숫자와 AI가 해석한 숫자가
 * 최대 12시간 어긋날 수 있고, 같은 심볼의 AI 요청마다 DB와 FMP를 다시 때린다. 캐시를 거치면 둘이 같은
 * 스냅샷을 보고(`staticSymbolCache`, FINRA 플래그가 키에 들어 있다) 비용도 한 번이다. 인프라 장애는
 * 그대로 던진다 — core가 `fetch_failed`로 바꾼다.
 */
export const investorFlowsCachedProvider: InvestorFlowsDataProvider = {
    getInvestorFlowsSnapshot: symbol => getInvestorFlowsSnapshot(symbol),
};
