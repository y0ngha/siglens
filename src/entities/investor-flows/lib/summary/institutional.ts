import type {
    InstitutionalHolderChange,
    InstitutionalQuarter,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import type {
    NetFlow,
    SummaryQuarter,
    SummaryHolder,
    SummaryPutCall,
} from './types';
import {
    SUMMARY_NAME_MAX_CHARS,
    SUMMARY_RATIO_DIGITS,
    round,
    clipSummaryText,
    pctChange,
} from './format';

/**
 * 에이전트 도구(`get_investor_flows`) 결과의 상한. 도구 결과 한도는 8,500자(`INVESTOR_FLOWS_RESULT_MAX_CHARS`)이고,
 * 봉투(`asOf`·`source`·`symbol`…)까지 합친 **도구 출력 전체**를 최악 입력으로 재도 600자 넘게 남아야 한다
 * (`getInvestorFlows.test.ts`가 최악 입력의 전체 출력 길이로 고정한다). 상한을 올리면 그 테스트가 먼저 깨진다.
 * 2026-10-16 수급 확장(Form 144·증자 공시·FTD·과열 목록·풋콜·숏스퀴즈)으로 늘어난 몫은 상위 보유 기관(10→8)과
 * 최근 내부자 거래(8→6)를 줄여 일부 갚았다. 신호 대상(`subject`)·숏스퀴즈 근거(`basis`·안내)를 더하면서 상위 보유 기관을 한 곳
 * 더(8→7) 줄였다.
 */
export const SUMMARY_MAX_TOP_HOLDERS = 7;

/** 요약에 싣는 13F 분기 수 상한(최신순). */
export const SUMMARY_MAX_QUARTERS = 2;

function netFlowOf(netShareChange: number): NetFlow {
    if (netShareChange > 0) return 'IN';
    if (netShareChange < 0) return 'OUT';
    return 'FLAT';
}

/** 13F 분기 한 개를 요약으로 줄인다. 진행 중 분기는 부분 집계라 `netFlow`가 `null`이다. */
export function summarizeQuarter(
    quarter: InstitutionalQuarter
): SummaryQuarter {
    return {
        period: quarter.period,
        complete: quarter.complete,
        holders: quarter.holders,
        shares: quarter.shares,
        newHolders: quarter.newHolders,
        increased: quarter.increased,
        decreased: quarter.decreased,
        exited: quarter.exited,
        netShareChange: quarter.netShareChange,
        netFlow: quarter.complete ? netFlowOf(quarter.netShareChange) : null,
    };
}

/** 상위 보유 기관 한 곳을 요약으로 줄인다 — 이름은 한 줄로 펴서 자르고, 변화율은 직전 분기 수량이 있을 때만 낸다. */
export function summarizeHolder(
    holder: InstitutionalHolderChange
): SummaryHolder {
    return {
        name: clipSummaryText(holder.filerName, SUMMARY_NAME_MAX_CHARS),
        shares: holder.shares,
        changePct: pctChange(holder.shares, holder.prevShares),
        change: holder.change,
    };
}

const PUT_CALL_NOTE =
    '13F option notional (underlying value, not premium); often hedges, not directional bets.';

/** 점수표의 13F 옵션 풋/콜 비율을 옮긴다. 옵션 분기가 없으면 `null`. */
export function summarizePutCall(
    scorecard: InvestorFlowsScorecard
): SummaryPutCall | null {
    const m = scorecard.institutional.metrics;
    if (m.optionsPeriod === null) return null;
    return {
        period: m.optionsPeriod,
        putCallValueRatio:
            m.putCallValueRatio === null
                ? null
                : round(m.putCallValueRatio, SUMMARY_RATIO_DIGITS),
        priorPutCallValueRatio:
            m.priorPutCallValueRatio === null
                ? null
                : round(m.priorPutCallValueRatio, SUMMARY_RATIO_DIGITS),
        note: PUT_CALL_NOTE,
    };
}
