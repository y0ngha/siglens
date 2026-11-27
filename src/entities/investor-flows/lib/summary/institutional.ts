import {
    readPutCallRatio,
    type InstitutionalHolderChange,
    type InstitutionalQuarter,
    type InvestorFlowsScorecard,
    type PutCallReading,
} from '@y0ngha/siglens-core';
import {
    SUMMARY_NAME_MAX_CHARS,
    SUMMARY_RATIO_DIGITS,
    round,
    clipSummaryText,
    pctChange,
} from './format';
import type {
    NetFlow,
    SummaryQuarter,
    SummaryHolder,
    SummaryPutCall,
} from './types';

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

/**
 * 13F 풋/콜 블록에 `reading`(명목금액 기준으로 읽은 쪽)을 `priorPutCallValueRatio` 바로 뒤에 끼운다. 읽는 값은 블록이 **출력하는**
 * `putCallValueRatio`라 모델이 인용하는 숫자와 쪽이 어긋날 수 없다. 기존 `reading`이 있으면 다시 계산한다. 평가 재생이 기록된
 * 옛 결과에 같은 함수를 부르도록 순수 함수로 둔다.
 */
export function withPutCallValueReading<
    P extends { putCallValueRatio: number | null },
>(putCall: P): P & { reading: PutCallReading | null } {
    const reading = readPutCallRatio(putCall.putCallValueRatio, 'notional');
    const entries = Object.entries(putCall).flatMap(
        ([key, value]): [string, unknown][] => {
            if (key === 'reading') return [];
            return key === 'priorPutCallValueRatio'
                ? [
                      [key, value],
                      ['reading', reading],
                  ]
                : [[key, value]];
        }
    );
    const withReading = Object.fromEntries(
        entries.some(([key]) => key === 'reading')
            ? entries
            : [...entries, ['reading', reading]]
    );
    return withReading as P & { reading: PutCallReading | null };
}

/** 점수표의 13F 옵션 풋/콜 비율을 옮긴다. 옵션 분기가 없으면 `null`. */
export function summarizePutCall(
    scorecard: InvestorFlowsScorecard
): SummaryPutCall | null {
    const m = scorecard.institutional.metrics;
    if (m.optionsPeriod === null) return null;
    return withPutCallValueReading({
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
    });
}
