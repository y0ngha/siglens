import type {
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
    ThresholdListStatus,
} from '@y0ngha/siglens-core';
import { computePreviousSettlementChange } from '../shortInterestChange';
import type {
    SummaryShort,
    SummaryFailsToDeliver,
    SummaryThresholdList,
    SummarySqueezeRisk,
} from './types';
import {
    SUMMARY_RATIO_DIGITS,
    SUMMARY_CHANGE_PCT_DIGITS,
    round,
    latestBy,
} from './format';

/** 숏스퀴즈 점수의 상위 구성요소 수 — core가 신호 근거에 싣는 수(`SQUEEZE_SIGNAL_EVIDENCE_COMPONENTS`)와 같다. */
export const SUMMARY_MAX_SQUEEZE_COMPONENTS = 3;

const SQUEEZE_PRICE_DELIVERY_ONLY_NOTE =
    'No short-positioning (FINRA short interest / short volume) input was used: this score reflects only fails-to-deliver, the threshold list and price/volume. It is not a short-squeeze reading - do not describe it as squeeze risk.';

const FTD_NOTE =
    'SEC fails-to-deliver, published ~2 weeks after each half-month. Fails are not evidence of naked short selling (SEC).';

/** 공매도 잔고·장외 거래량 섹션. 둘 다 비면 빈 블록을 내지 않고 `null`이다. */
export function summarizeShort(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): SummaryShort | null {
    const { shortInterest, shortVolume } = snapshot;
    const latest = latestBy(shortInterest ?? [], row => row.settlementDate);
    const latestVolume = latestBy(shortVolume ?? [], row => row.date);
    // 플래그 꺼짐(`null`)이든 켜졌는데 행이 없든(`[]`) 둘 다 비면 블록 자체를 내지 않는다 — 빈 블록은 "공매도 0"으로 읽힌다.
    if (latest === null && latestVolume === null) return null;
    const metrics = scorecard.short.metrics;
    const changeVsPrevious = computePreviousSettlementChange(
        shortInterest ?? []
    );
    return {
        interest:
            latest === null
                ? null
                : {
                      settlementDate: latest.settlementDate,
                      shortQty: latest.shortQty,
                      pctOfFloat: metrics.shortInterestPctFloat,
                      daysToCover: metrics.daysToCover,
                      changeVsPrevious:
                          changeVsPrevious === null
                              ? null
                              : {
                                    ...changeVsPrevious,
                                    pct:
                                        changeVsPrevious.pct === null
                                            ? null
                                            : round(
                                                  changeVsPrevious.pct,
                                                  SUMMARY_CHANGE_PCT_DIGITS
                                              ),
                                },
                      recentChangePct: metrics.shortInterestChangePct,
                      recentChangeFromDate: metrics.shortInterestChangeFromDate,
                      recentChangeToDate: metrics.shortInterestChangeToDate,
                      trend: metrics.shortInterestTrend,
                  },
        offExchangeVolume:
            latestVolume === null
                ? null
                : {
                      date: latestVolume.date,
                      shortRatio: metrics.shortVolumeRatio,
                      zScore: metrics.shortVolumeRatioZ,
                  },
        squeezeRisk: metrics.squeezeRisk,
        note: 'FINRA short volume covers off-exchange (TRF) trades only.',
    };
}

/** 결제 불이행 섹션. FTD 행이 없으면 `null`. */
export function summarizeFailsToDeliver(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): SummaryFailsToDeliver | null {
    const latest = latestBy(
        snapshot.failsToDeliver ?? [],
        row => row.settlementDate
    );
    if (latest === null) return null;
    const m = scorecard.short.metrics;
    return {
        latestDate: latest.settlementDate,
        latestQty: latest.failsQty,
        peakQty: m.failsToDeliverPeakQty,
        peakDate: m.failsToDeliverPeakDate,
        peakPctOutstanding:
            m.failsToDeliverPctOutstanding === null
                ? null
                : round(m.failsToDeliverPctOutstanding, SUMMARY_RATIO_DIGITS),
        peakMultipleOfBaseline:
            m.failsToDeliverMultiple === null
                ? null
                : round(m.failsToDeliverMultiple, 1),
        note: FTD_NOTE,
    };
}

/** 과열 목록 상태를 옮긴다. 스냅샷에 없으면 `null`. */
export function summarizeThresholdList(
    status: ThresholdListStatus | null | undefined
): SummaryThresholdList | null {
    if (status === null || status === undefined) return null;
    return {
        listed: status.listed,
        consecutiveDays: status.consecutiveDays,
        firstListedDate: status.firstListedDate,
        markets: status.markets,
        asOf: status.asOf ?? null,
    };
}

/** 숏스퀴즈 점수 섹션. 점수가 없으면 `null`이고, 포지션 입력이 없으면 `basis`와 안내(`note`)로 오독을 막는다. */
export function summarizeSqueezeRisk(
    scorecard: InvestorFlowsScorecard
): SummarySqueezeRisk | null {
    const risk = scorecard.squeezeRisk;
    if (risk === null) return null;
    return {
        score: risk.score,
        level: risk.level,
        sufficiency: risk.sufficiency,
        levelCapped: risk.levelCapped,
        topComponents: risk.components
            .slice(0, SUMMARY_MAX_SQUEEZE_COMPONENTS)
            .map(component => ({
                id: component.id,
                value: round(component.value, SUMMARY_RATIO_DIGITS),
                contribution: component.contribution,
            })),
        lastBarDate: risk.lastBarDate,
        ...(risk.includesFinra
            ? { basis: 'positioning' as const }
            : {
                  basis: 'price_delivery_only' as const,
                  note: SQUEEZE_PRICE_DELIVERY_ONLY_NOTE,
              }),
    };
}
