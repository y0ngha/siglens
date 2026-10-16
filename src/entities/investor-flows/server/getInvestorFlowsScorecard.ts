import 'server-only';
import {
    evaluateInvestorFlows,
    type InvestorFlowsScorecard,
    type InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { maskUncollectedSections } from '../lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '../model';
import { getInvestorFlowsEvaluationOptions } from './getInvestorFlowsEvaluationOptions';
import { getInvestorFlowsPipelineReadiness } from './getInvestorFlowsPipelineReadiness';
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
    /**
     * 이 결과가 만들어질 때의 Reg SHO 과열 목록 플래그 상태(`REG_SHO_THRESHOLD_DATA_ENABLED`). 화면은 이 값이 참일 때만
     * 과열 목록 배지와 거래소 출처를 그린다(거래소 데이터 비상업 라이선스 — 꺼지면 흔적도 남기지 않는다).
     */
    regShoEnabled: boolean;
    /**
     * 수집 파이프라인 준비 상태(종목 무관). 화면·에이전트가 빈 구간을 "데이터 없음"과 "아직 수집 중"으로 가르는
     * 근거다. 상태를 못 읽으면 모든 갈래가 `unknown`이고, 이때는 예전 동작(빈 상태)을 그대로 쓴다.
     */
    readiness: InvestorFlowsPipelineReadiness;
}

/**
 * 렌더 경로·에이전트 도구·종합 분석이 같이 쓰는 "스냅샷 + 점수표" 로더.
 *
 * 점수표는 **코드가 계산**한다(`evaluateInvestorFlows`) — 화면 점수와 AI가 해석하는 점수가 같은 함수·같은 옵션
 * (`getInvestorFlowsEvaluationOptions`: FINRA·Reg SHO 플래그, 숏스퀴즈 일봉)에서 나오게 한 곳에 모았다. 플래그가 꺼져 있으면
 * 스냅샷이 이미 그 필드를 `null`로 주지만, 캐시된 옛 스냅샷이 남아도 점수에 섞이지 않도록 옵션도 함께 넘긴다.
 *
 * 채점 입력은 AI 해석(`investorFlowsCachedProvider`)과 같은 마스킹(`maskUncollectedSections`)을 거친다 — 아직 수집 중인 빈
 * 구간이 "없음"으로 채점되지 않게 하고, 두 경로의 점수가 같게 한다. 돌려주는 `snapshot`은 원본이다(화면은 수집 중 판정을
 * `resolveCollectingArms`로 따로 한다).
 */
export async function getInvestorFlowsScorecard(
    symbol: string
): Promise<InvestorFlowsScorecardResult> {
    const [{ snapshot, degraded }, readiness, options] = await Promise.all([
        getInvestorFlowsResilient(symbol),
        getInvestorFlowsPipelineReadiness(),
        getInvestorFlowsEvaluationOptions(symbol),
    ]);
    return {
        snapshot,
        scorecard:
            snapshot === null
                ? null
                : evaluateInvestorFlows(
                      maskUncollectedSections(snapshot, readiness),
                      options
                  ),
        degraded,
        finraEnabled: options.includeFinraData,
        regShoEnabled: options.includeExchangeLists,
        readiness,
    };
}
