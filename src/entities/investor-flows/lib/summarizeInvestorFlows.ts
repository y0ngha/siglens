import type {
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from './investorFlowsDates';
import type { InvestorFlowsSummary } from './summary/types';
import {
    SUMMARY_MAX_TOP_HOLDERS,
    SUMMARY_MAX_QUARTERS,
    summarizeQuarter,
    summarizeHolder,
    summarizePutCall,
} from './summary/institutional';
import {
    SUMMARY_MAX_INSIDER_TRANSACTIONS,
    SUMMARY_MAX_LARGE_HOLDERS,
    SUMMARY_MAX_PROPOSED_SALES,
    summarizeTransaction,
    summarizeLargeHolder,
    countProposedSales,
    summarizeProposedSale,
} from './summary/insider';
import { SUMMARY_MAX_OFFERINGS, summarizeOffering } from './summary/dilution';
import {
    summarizeShort,
    summarizeFailsToDeliver,
    summarizeThresholdList,
    summarizeSqueezeRisk,
} from './summary/short';
import { pickSummarySignals, summarizeAxis } from './summary/signals';

/**
 * 에이전트 도구 `get_investor_flows`가 모델에 주는 **압축 요약**. 모델이 계산하지 않도록 점수·라벨·공매도 비율은
 * 코드가 계산한 `scorecard`에서 그대로 옮기고, 원본 목록은 상한(`SUMMARY_MAX_*`)으로 자른다.
 *
 * FINRA 플래그가 꺼져 있거나(`snapshot.shortInterest === null`) 켜졌는데 잔고·장외 거래량 행이 하나도 없으면 `short` 블록은
 * `null`이다 — 점수표의 공매도 축도 `insufficient`로 와서 "없음"이 "중립"으로 읽히지 않는다. 과열 목록도 플래그가 꺼지면 스냅샷이
 * `null`이라 `thresholdList`가 `null`이다. 숏스퀴즈 점수·FTD 배수·풋/콜 비율은 점수표(core) 값을 옮길 뿐 여기서 계산하지 않는다
 * (반올림만 — 비율·발행주식 대비 %는 core와 같은 소수 4자리, 직전 결제일 대비 변화율은 2자리). 진행 중 13F 분기는 `netFlow: null`이고,
 * 공시 원문 이름·문구는 한 줄로 편 뒤 자른다(`clipSummaryText`).
 */
export function summarizeInvestorFlows(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): InvestorFlowsSummary {
    return {
        composite: scorecard.composite,
        axes: {
            institutional: summarizeAxis(scorecard.institutional),
            insider: summarizeAxis(scorecard.insider),
            largeHolders: summarizeAxis(scorecard.largeHolders),
            short: summarizeAxis(scorecard.short),
            dilution: summarizeAxis(scorecard.dilution),
        },
        signals: pickSummarySignals(scorecard),
        freshness: scorecard.freshness,
        institutional: {
            quarters: snapshot.institutional.quarters
                .toSorted((a, b) => compareIsoDate(b.period, a.period))
                .slice(0, SUMMARY_MAX_QUARTERS)
                .map(summarizeQuarter),
            topHoldersPeriod: snapshot.institutional.topHoldersPeriod,
            topHolders: snapshot.institutional.topHolders
                .slice(0, SUMMARY_MAX_TOP_HOLDERS)
                .map(summarizeHolder),
            putCall: summarizePutCall(scorecard),
        },
        insider: {
            metrics: scorecard.insider.metrics,
            recentTransactions: snapshot.insider.transactions
                .toSorted((a, b) => compareIsoDate(b.date, a.date))
                .slice(0, SUMMARY_MAX_INSIDER_TRANSACTIONS)
                .map(summarizeTransaction),
            proposedSales:
                snapshot.proposedSales === undefined
                    ? null
                    : snapshot.proposedSales
                          .toSorted((a, b) =>
                              compareIsoDate(b.filingDate, a.filingDate)
                          )
                          .slice(0, SUMMARY_MAX_PROPOSED_SALES)
                          .map(summarizeProposedSale),
            proposedSalesCounts:
                snapshot.proposedSales === undefined
                    ? null
                    : countProposedSales(snapshot.proposedSales, snapshot.asOf),
        },
        largeHolders:
            snapshot.largeHolders === null
                ? null
                : snapshot.largeHolders
                      .toSorted((a, b) =>
                          compareIsoDate(b.filingDate, a.filingDate)
                      )
                      .slice(0, SUMMARY_MAX_LARGE_HOLDERS)
                      .map(summarizeLargeHolder),
        offerings:
            snapshot.offerings === undefined
                ? null
                : snapshot.offerings
                      .toSorted((a, b) =>
                          compareIsoDate(b.filingDate, a.filingDate)
                      )
                      .slice(0, SUMMARY_MAX_OFFERINGS)
                      .map(summarizeOffering),
        short: summarizeShort(snapshot, scorecard),
        failsToDeliver: summarizeFailsToDeliver(snapshot, scorecard),
        thresholdList: summarizeThresholdList(snapshot.thresholdList),
        squeezeRisk: summarizeSqueezeRisk(scorecard),
    };
}
