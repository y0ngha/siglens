import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatDecimal,
    formatInteger,
    formatPercent,
    formatSignedCompact,
    formatSignedPercent,
    formatUsdCompact,
} from './flowFormat';

/** Form 144 예정 주식의 발행주식 대비 % 자리 — core 판정 경계가 0.05%·0.25%라 세 자리면 경계 근처가 갈린다. */
const PROPOSED_SALE_PCT_DIGITS = 3;

/** 점수표 카드가 축마다 보여 주는 근거 한 줄 — 카탈로그 키(`widgets.investor-flows.ev.<id>`)와 보간 값이다. */
export interface AxisEvidenceLine {
    id: string;
    values: Record<string, string>;
}

function institutionalLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.institutional.metrics;
    const holdersId =
        m.holderCountChangePct === null ? 'holdersOnly' : 'holders';
    const holdersChange =
        m.holderCountChangePct === null
            ? ''
            : formatSignedPercent(m.holderCountChangePct, locale);
    const netSharesId =
        m.netShareChangeBasis === 'priorHoldings'
            ? 'netSharesPrior'
            : 'netSharesOutstanding';
    return [
        ...(m.holders === null
            ? []
            : [
                  {
                      id: holdersId,
                      values: {
                          count: formatInteger(m.holders, locale),
                          change: holdersChange,
                      },
                  },
              ]),
        ...(m.netShareChangePct === null
            ? []
            : [
                  {
                      id: netSharesId,
                      values: {
                          pct: formatSignedPercent(
                              m.netShareChangePct,
                              locale,
                              2
                          ),
                      },
                  },
              ]),
        ...(m.newHolders === null || m.exited === null
            ? []
            : [
                  {
                      id: 'newExited',
                      values: {
                          added: formatInteger(m.newHolders, locale),
                          exited: formatInteger(m.exited, locale),
                      },
                  },
              ]),
        ...(m.putCallValueRatio === null
            ? []
            : [
                  {
                      id: 'putCallRatio',
                      values: {
                          ratio: formatDecimal(m.putCallValueRatio, locale, 2),
                      },
                  },
              ]),
    ];
}

/** 한국 임원·주요주주 축 — core `insider.krMetrics`(DART 소유보고·거래계획). */
function krInsiderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.insider.krMetrics;
    if (m === undefined) return [];
    const days = formatInteger(scorecard.freshness.insiderWindow.days, locale);
    return [
        {
            id: 'krInsiderReports',
            values: {
                days,
                reports: formatInteger(m.reports, locale),
                reporters: formatInteger(m.reporters, locale),
            },
        },
        {
            id: 'krInsiderNetShares',
            values: { shares: formatSignedCompact(m.netSharesChange, locale) },
        },
        ...(m.netChangePct === null
            ? []
            : [
                  {
                      id: 'krInsiderNetPct',
                      values: {
                          pct: formatSignedPercent(m.netChangePct, locale, 2),
                      },
                  },
              ]),
        ...(m.tradingPlans === 0
            ? []
            : [
                  {
                      id: 'krTradingPlans',
                      values: {
                          count: formatInteger(m.tradingPlans, locale),
                      },
                  },
              ]),
    ];
}

/** 한국 대량보유 축 — core `largeHolders.krMetrics`(DART 대량보유 보고). */
function krLargeHolderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.largeHolders.krMetrics;
    if (m === undefined) return [];
    return [
        {
            id: 'krMajorHolderReports',
            values: {
                days: formatInteger(
                    scorecard.freshness.largeHolderWindow.days,
                    locale
                ),
                reports: formatInteger(m.reports, locale),
                reporters: formatInteger(m.reporters, locale),
            },
        },
        ...(m.detailedReports === 0
            ? []
            : [
                  {
                      id: 'krMajorHolderDetailed',
                      values: {
                          count: formatInteger(m.detailedReports, locale),
                      },
                  },
              ]),
    ];
}

function insiderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    if (scorecard.market === 'kr') return krInsiderLines(scorecard, locale);
    const m = scorecard.insider.metrics;
    if (m === null) return [];
    const days = formatInteger(scorecard.freshness.insiderWindow.days, locale);
    return [
        {
            id: m.netValueUsd >= 0 ? 'insiderNetBuy' : 'insiderNetSell',
            values: {
                days,
                amount: formatUsdCompact(Math.abs(m.netValueUsd), locale),
            },
        },
        {
            id: 'insiderCounts',
            values: {
                buys: formatInteger(m.buyCount, locale),
                sells: formatInteger(m.sellCount, locale),
            },
        },
        ...(m.clusterBuy
            ? [
                  {
                      id: 'insiderCluster',
                      values: {
                          count: formatInteger(m.largestBuyCluster, locale),
                      },
                  },
              ]
            : []),
        ...(m.proposedSaleCount === 0
            ? []
            : [
                  {
                      id: 'insiderProposedSales',
                      values: {
                          count: formatInteger(m.proposedSaleCount, locale),
                          amount: formatUsdCompact(
                              m.proposedSaleValueUsd,
                              locale
                          ),
                      },
                  },
                  ...(m.proposedSalePctOutstanding === null
                      ? []
                      : [
                            {
                                id: 'insiderProposedSalePct',
                                values: {
                                    pct: formatPercent(
                                        m.proposedSalePctOutstanding,
                                        locale,
                                        PROPOSED_SALE_PCT_DIGITS
                                    ),
                                },
                            },
                        ]),
              ]),
    ];
}

function largeHolderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    if (scorecard.market === 'kr') return krLargeHolderLines(scorecard, locale);
    const m = scorecard.largeHolders.metrics;
    if (m === null) return [];
    return [
        {
            id: 'largeHolderCounts',
            values: {
                d: formatInteger(m.filings13d, locale),
                g: formatInteger(m.filings13g, locale),
                days: formatInteger(
                    scorecard.freshness.largeHolderWindow.days,
                    locale
                ),
            },
        },
    ];
}

function shortLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.short.metrics;
    return [
        ...(m.shortInterestPctFloat === null
            ? []
            : [
                  {
                      id: 'shortPct',
                      values: {
                          pct: formatPercent(
                              m.shortInterestPctFloat,
                              locale,
                              2
                          ),
                      },
                  },
              ]),
        ...(m.daysToCover === null
            ? []
            : [
                  {
                      id: 'daysToCover',
                      values: { days: formatDecimal(m.daysToCover, locale, 1) },
                  },
              ]),
        ...(m.shortInterestChangePct === null
            ? []
            : [
                  {
                      id: 'shortTrend',
                      values: {
                          pct: formatSignedPercent(
                              m.shortInterestChangePct,
                              locale
                          ),
                      },
                  },
              ]),
        ...(m.shortVolumeRatio === null
            ? []
            : [
                  {
                      id: 'shortRatio',
                      values: {
                          pct: formatPercent(
                              m.shortVolumeRatio * 100,
                              locale,
                              1
                          ),
                      },
                  },
              ]),
        ...(m.failsToDeliverPctOutstanding === null
            ? []
            : [
                  {
                      id: 'ftdPct',
                      values: {
                          pct: formatPercent(
                              m.failsToDeliverPctOutstanding,
                              locale,
                              2
                          ),
                      },
                  },
              ]),
        ...(m.thresholdListed === true && m.thresholdConsecutiveDays !== null
            ? [
                  {
                      id: 'thresholdListed',
                      values: {
                          days: formatInteger(
                              m.thresholdConsecutiveDays,
                              locale
                          ),
                      },
                  },
              ]
            : []),
    ];
}

function dilutionLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.dilution.metrics;
    if (m === null) return [];
    return [
        {
            id: 'dilutionFilings',
            values: {
                count: formatInteger(m.filingsInWindow, locale),
                days: formatInteger(
                    scorecard.freshness.dilutionWindow.days,
                    locale
                ),
            },
        },
        ...(m.atmFilings + m.marketedOfferingFilings === 0
            ? []
            : [
                  {
                      id: 'dilutionIssuance',
                      values: {
                          atm: formatInteger(m.atmFilings, locale),
                          marketed: formatInteger(
                              m.marketedOfferingFilings,
                              locale
                          ),
                      },
                  },
              ]),
    ];
}

/**
 * 축별 근거 수치. 점수표의 `metrics`만 읽는다(재계산 금지) — `sufficiency: 'insufficient'`인 축은
 * 근거 줄을 만들지 않는다. 점수가 없는 축에 `0` 같은 숫자를 늘어놓으면 중립으로 읽히기 때문이다. 한국 점수표(`market: 'kr'`)의
 * 내부자·대량보유 축은 DART 수치(`krMetrics`)로 근거를 만든다.
 */
export function buildAxisEvidence(
    scorecard: InvestorFlowsScorecard,
    axis: InvestorFlowsAxisId,
    locale: Locale
): AxisEvidenceLine[] {
    if (scorecard[axis].sufficiency === 'insufficient') return [];
    switch (axis) {
        case 'institutional':
            return institutionalLines(scorecard, locale);
        case 'insider':
            return insiderLines(scorecard, locale);
        case 'largeHolders':
            return largeHolderLines(scorecard, locale);
        case 'short':
            return shortLines(scorecard, locale);
        case 'dilution':
            return dilutionLines(scorecard, locale);
    }
}
