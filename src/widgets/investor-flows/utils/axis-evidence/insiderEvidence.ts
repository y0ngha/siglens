/**
 * 내부자 축의 근거 줄 — 미국은 Form 4·Form 144 지표, 한국은 DART 소유보고 지표로 만든다.
 */
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatInteger,
    formatSmallPercent,
    formatUsdCompact,
} from '../flowFormat';
import { flowDirection, type FlowDirection } from '../institutional';
import { presentLines, type AxisEvidenceLine } from './evidenceLine';
import { krInsiderLines } from './krInsiderEvidence';

/** Form 144 예정 주식의 발행주식 대비 % 자리 — core 판정 경계가 0.05%·0.25%라 세 자리면 경계 근처가 갈린다. */
const PROPOSED_SALE_PCT_DIGITS = 3;

/**
 * 순매수 근거 줄의 방향별 키. 방향은 요약 카드(`InsiderSummaryCards`)와 같은 `flowDirection`으로 가른다 — 순액이 정확히 0이면
 * 둘 다 "순매수도 순매도도 아님"으로 말한다.
 */
const NET_EVIDENCE_ID: Record<FlowDirection, string> = {
    in: 'insiderNetBuy',
    out: 'insiderNetSell',
    flat: 'insiderNetFlat',
};

/** 한국은 DART 소유보고 근거, 미국은 순매수/순매도·건수·클러스터 매수·Form 144 근거. */
export function insiderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    if (scorecard.market === 'kr') return krInsiderLines(scorecard, locale);
    const m = scorecard.insider.metrics;
    if (m === null) return [];
    const days = formatInteger(scorecard.freshness.insiderWindow.days, locale);
    const hasProposedSales = m.proposedSaleCount > 0;
    return presentLines([
        {
            id: NET_EVIDENCE_ID[flowDirection(m.netValueUsd)],
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
        m.clusterBuy
            ? {
                  id: 'insiderCluster',
                  values: {
                      count: formatInteger(m.largestBuyCluster, locale),
                  },
              }
            : null,
        hasProposedSales
            ? {
                  id: 'insiderProposedSales',
                  values: {
                      count: formatInteger(m.proposedSaleCount, locale),
                      amount: formatUsdCompact(m.proposedSaleValueUsd, locale),
                  },
              }
            : null,
        hasProposedSales && m.proposedSalePctOutstanding !== null
            ? {
                  id: 'insiderProposedSalePct',
                  values: {
                      // 대형주는 Form 144 몇 건이 발행주식의 0.001%도 안 된다 — `0.000%`가 아니라 `<0.001%`로 보인다.
                      pct: formatSmallPercent(
                          m.proposedSalePctOutstanding,
                          locale,
                          PROPOSED_SALE_PCT_DIGITS
                      ),
                  },
              }
            : null,
    ]);
}
