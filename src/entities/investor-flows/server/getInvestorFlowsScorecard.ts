import 'server-only';
import {
    evaluateInvestorFlows,
    type InvestorFlowsScorecard,
    type InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { getInvestorFlowsResilient } from './getInvestorFlowsResilient';

export interface InvestorFlowsScorecardResult {
    /** 데이터가 없는 종목이거나 인프라 장애면 `null`. */
    snapshot: InvestorFlowsSnapshot | null;
    /** `snapshot`이 있을 때만 값이 있다 — 스냅샷 없이 점수를 만들어 내지 않는다. */
    scorecard: InvestorFlowsScorecard | null;
    /** true = 인프라 실패("데이터 없음"과 다르다). 페이지의 degrade/noindex 판정 근거. */
    degraded: boolean;
    /**
     * 이 결과가 만들어질 때의 FINRA 플래그 상태. 화면은 이 값으로 공매도 섹션을 낼지 정한다 —
     * 스냅샷의 `shortInterest`가 `null`이면 "플래그 꺼짐"이고 `[]`이면 "켜졌는데 데이터 없음"이다.
     */
    finraEnabled: boolean;
}

/**
 * 렌더 경로·에이전트 도구·종합 분석이 같이 쓰는 "스냅샷 + 점수표" 로더.
 *
 * 점수표는 **코드가 계산**한다(`evaluateInvestorFlows`) — 화면 점수와 AI가 해석하는 점수가 같은
 * 함수·같은 `includeFinraData`에서 나오게 한 곳에 모았다. FINRA 플래그가 꺼져 있으면 스냅샷이
 * 이미 공매도 필드를 `null`로 주지만, 캐시된 옛 스냅샷이 남아도 점수에 섞이지 않도록 옵션도 함께 넘긴다.
 */
export async function getInvestorFlowsScorecard(
    symbol: string
): Promise<InvestorFlowsScorecardResult> {
    const finraEnabled = isFinraShortDataEnabled();
    const { snapshot, degraded } = await getInvestorFlowsResilient(symbol);
    return {
        snapshot,
        scorecard:
            snapshot === null
                ? null
                : evaluateInvestorFlows(snapshot, {
                      includeFinraData: finraEnabled,
                  }),
        degraded,
        finraEnabled,
    };
}
