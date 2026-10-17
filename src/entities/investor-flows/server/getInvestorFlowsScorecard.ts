import 'server-only';
import {
    evaluateInvestorFlows,
    type InvestorFlowsMarket,
    type InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { maskUncollectedSections } from '../lib/investorFlowsReadiness';
import type {
    InvestorFlowsPipelineReadiness,
    InvestorFlowsSnapshotWithStatus,
    KrDisclosureCompany,
} from '../model';
import { getKrDartCorp } from './getKrDartCorp';
import { getInvestorFlowsEvaluationOptions } from './getInvestorFlowsEvaluationOptions';
import { getInvestorFlowsPipelineReadiness } from './getInvestorFlowsPipelineReadiness';
import { getInvestorFlowsResilient } from './getInvestorFlowsResilient';

export interface InvestorFlowsScorecardResult {
    /** 종목의 시장. 화면·도구가 미국(13F·FINRA·SEC)과 한국(DART) 구성을 가른다. */
    market: InvestorFlowsMarket;
    /** 한국 종목이고 DART 회사 매핑이 있을 때만 값이 있다(미국 종목·매핑 실패·조회 실패면 `null`). */
    krCompany: KrDisclosureCompany | null;
    /** 데이터가 없는 종목이거나 인프라 장애면 `null`. FMP 일시 오류로 일부가 비었으면 `snapshot.degraded`에 적혀 있다. */
    snapshot: InvestorFlowsSnapshotWithStatus | null;
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
 *
 * 한국 종목(`005930.KS`)은 DART 지분공시 스냅샷(`market: 'kr'`)이고, 미국 갈래 마스킹은 할 일이 없다(한국 스냅샷의 미국 필드는
 * 처음부터 비어 있거나 `null`). 우선주 안내용 회사 정보(`krCompany`)를 함께 읽는다.
 */
export async function getInvestorFlowsScorecard(
    symbol: string
): Promise<InvestorFlowsScorecardResult> {
    const kr = isKrEquitySymbol(symbol);
    const [{ snapshot, degraded }, readiness, options, corp] =
        await Promise.all([
            getInvestorFlowsResilient(symbol),
            getInvestorFlowsPipelineReadiness(),
            getInvestorFlowsEvaluationOptions(symbol),
            kr ? getKrDartCorp(symbol) : Promise.resolve(null),
        ]);
    return {
        market: options.market,
        krCompany:
            corp === null
                ? null
                : {
                      corpName: corp.corpName,
                      viaCommonShare: corp.viaCommonShare,
                  },
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
