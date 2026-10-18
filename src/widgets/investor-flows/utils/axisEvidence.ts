import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
    InvestorFlowsSignal,
    KrInsiderMetrics,
    KrMajorHolderMetrics,
} from '@y0ngha/siglens-core';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import {
    formatDecimal,
    formatInteger,
    formatPercent,
    formatSignedCompact,
    formatSignedPercent,
    formatSmallPercent,
    formatUsdCompact,
} from './flowFormat';

/** Form 144 예정 주식의 발행주식 대비 % 자리 — core 판정 경계가 0.05%·0.25%라 세 자리면 경계 근처가 갈린다. */
const PROPOSED_SALE_PCT_DIGITS = 3;

/**
 * 하루치 일괄 보고를 "포함" 주석으로 밝히는 건수 하한 — 한 접수일에 이 건수 이상일 때만 쓴다. 표시용 휴리스틱이며,
 * core `KR_INSIDER_ROUTINE_MASS_FILING_MAX_REPORTERS`(30일 범위의 고유 보고자 수, 엄격 비교)와 같은 판정이 아니라
 * 규모 숫자만 맞춘 것이다.
 */
export const KR_BATCH_FILING_MIN_COUNT = 30;

/** 하루치가 창 전체 보고의 이 비율 이상이어야 주석을 낸다 — 절반이 넘어야 "건수가 한 번에 몰렸다"는 설명이 맞다. */
export const KR_BATCH_FILING_MIN_SHARE = 0.5;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface BatchFilingNote {
    date: string;
    batchCount: string;
}

/**
 * core `largestSingleDayFiling`이 화면에 주석으로 쓸 만큼 큰 하루 일괄 보고인지 판정해 보간 값을 돌려준다. 보고가 없거나,
 * 하루 건수가 전체보다 크거나, 날짜가 올바르지 않으면 null이다. 날짜는 UTC로 해석해 시간대에 따른 하루 밀림을 막는다.
 */
export function batchFilingNote(
    m: Pick<KrInsiderMetrics, 'reports' | 'largestSingleDayFiling'>,
    locale: Locale
): BatchFilingNote | null {
    const filing = m.largestSingleDayFiling;
    if (filing === undefined || filing === null) return null;
    if (m.reports <= 0 || filing.count > m.reports) return null;
    if (filing.count < KR_BATCH_FILING_MIN_COUNT) return null;
    if (filing.count < m.reports * KR_BATCH_FILING_MIN_SHARE) return null;
    const match = ISO_DATE.exec(filing.date);
    if (match === null) return null;
    const [, y, mo, d] = match.map(Number);
    const utc = new Date(Date.UTC(y, mo - 1, d));
    if (
        utc.getUTCFullYear() !== y ||
        utc.getUTCMonth() !== mo - 1 ||
        utc.getUTCDate() !== d
    ) {
        return null;
    }
    return {
        date: new Intl.DateTimeFormat(INTL_LOCALE[locale], {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(utc),
        batchCount: formatInteger(filing.count, locale),
    };
}

/** 점수표 카드가 축마다 보여 주는 근거 한 줄 — 카탈로그 키(`widgets.investor-flows.ev.<id>`)와 보간 값이다. */
export interface AxisEvidenceLine {
    id: string;
    values: Record<string, string>;
}

/**
 * 채점된(`sufficient`) 한국 축에 방향 신호가 하나도 없다 — core가 "보고는 창 안에 있는데 유의미한 변동이 없다"를 중립
 * 측정값(score 0, `kr_*_no_material_change` 또는 일상적 대량 신고 노트)으로 준 경우다. 데이터 부족이 아니므로 "변동 없음"을
 * 근거 줄로 밝힌다. 방향을 다시 판정하지 않고 core 신호의 `direction`만 읽는다.
 */
function isMeasuredNoChange(signals: readonly InvestorFlowsSignal[]): boolean {
    return signals.every(signal => signal.direction === 'neutral');
}

/** 한국 축이 "창 안 보고 없음"으로 비었을 때 보여 줄 창 길이와 최신 접수일. */
export interface NoReportsInWindow {
    readonly days: string;
    readonly latestReceiptDate: string;
}

/**
 * 한국 대량보유·임원 축이 `insufficient`인데 core가 `krMetrics`를 `reports === 0`과 `latestReceiptDate`로 준 경우 — 쓸 수
 * 있는 보고가 채점 창(최근 N일) 밖에만 있다. "데이터 부족"이 아니라 "최근 N일 공시 없음(최신 접수일 …)"으로 말해야 해서
 * 창 길이와 접수일을 돌려준다. 그 밖의 경우(미국 점수표, 채점된 축, 보고가 아예 없는 축)는 `null`이다.
 */
export function krNoReportsInWindow(
    scorecard: InvestorFlowsScorecard,
    axis: InvestorFlowsAxisId,
    locale: Locale
): NoReportsInWindow | null {
    if (scorecard.market !== 'kr') return null;
    if (scorecard[axis].sufficiency !== 'insufficient') return null;
    const krWindow = krAxisWindow(scorecard, axis);
    const latestReceiptDate = krWindow?.metrics?.latestReceiptDate ?? null;
    if (
        krWindow === null ||
        krWindow.metrics?.reports !== 0 ||
        latestReceiptDate === null
    ) {
        return null;
    }
    return { days: formatInteger(krWindow.days, locale), latestReceiptDate };
}

/** DART 원천이 있는 한국 축의 `krMetrics`(창 안 보고 수·최신 접수일)와 채점 창 길이. */
interface KrAxisWindow {
    readonly metrics:
        | Pick<
              KrMajorHolderMetrics | KrInsiderMetrics,
              'reports' | 'latestReceiptDate'
          >
        | undefined;
    readonly days: number;
}

/** 한국 점수표에서 DART 원천이 있는 두 축만 창을 돌려준다. 그 밖의 축은 `null`이다. */
function krAxisWindow(
    scorecard: InvestorFlowsScorecard,
    axis: InvestorFlowsAxisId
): KrAxisWindow | null {
    switch (axis) {
        case 'largeHolders':
            return {
                metrics: scorecard.largeHolders.krMetrics,
                days: scorecard.freshness.largeHolderWindow.days,
            };
        case 'insider':
            return {
                metrics: scorecard.insider.krMetrics,
                days: scorecard.freshness.insiderWindow.days,
            };
        case 'institutional':
        case 'short':
        case 'dilution':
            return null;
    }
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
    const batch = batchFilingNote(m, locale);
    return [
        {
            id: batch !== null ? 'krInsiderReportsBatch' : 'krInsiderReports',
            values: {
                days,
                reports: formatInteger(m.reports, locale),
                reporters: formatInteger(m.reporters, locale),
                ...batch,
            },
        },
        ...(isMeasuredNoChange(scorecard.insider.signals)
            ? [{ id: 'krInsiderNoChange', values: {} }]
            : []),
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
        ...(isMeasuredNoChange(scorecard.largeHolders.signals) &&
        m.maxAbsRatioChangePct !== null
            ? [
                  {
                      id: 'krMajorHolderNoChange',
                      values: {
                          pct: formatDecimal(m.maxAbsRatioChangePct, locale, 2),
                      },
                  },
              ]
            : []),
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
                                    // 대형주는 Form 144 몇 건이 발행주식의 0.001%도 안 된다 — `0.000%`가 아니라
                                    // `<0.001%`로 보인다.
                                    pct: formatSmallPercent(
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
    // 포지션(`events*`: 신고인별 정정 접기·공동 신고 병합 후)과 신고(`filings*`: 원본·정정 건수)는 다르다 — 한 보유자의
    // 13D/A 일곱 건은 포지션 1·신고 7이다. 신고 수를 보유자 수로 읽지 않게 둘을 함께 보인다.
    return [
        {
            id: 'largeHolderCounts',
            values: {
                d: formatInteger(m.events13d, locale),
                df: formatInteger(m.filings13d, locale),
                g: formatInteger(m.events13g, locale),
                gf: formatInteger(m.filings13g, locale),
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
    // 조회 기간 전체에 공시가 하나도 없다(core `noFilingsOnRecord`) — 채점된 중립이다. "0건" 대신 "공시 없음"으로 말한다.
    if (scorecard.dilution.noFilingsOnRecord) {
        return [{ id: 'dilutionNoneOnRecord', values: {} }];
    }
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
