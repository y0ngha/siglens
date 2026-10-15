import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatDecimal,
    formatInteger,
    formatPercent,
    formatSignedPercent,
    formatUsdCompact,
} from './flowFormat';

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
    ];
}

function insiderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
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
    ];
}

function largeHolderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
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
    ];
}

/**
 * 축별 근거 수치. 점수표의 `metrics`만 읽는다(재계산 금지) — `sufficiency: 'insufficient'`인 축은
 * 근거 줄을 만들지 않는다. 점수가 없는 축에 `0` 같은 숫자를 늘어놓으면 중립으로 읽히기 때문이다.
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
    }
}
