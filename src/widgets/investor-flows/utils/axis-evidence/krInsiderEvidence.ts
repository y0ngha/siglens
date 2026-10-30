/**
 * 한국 임원·주요주주 축의 근거 줄 — core `insider.krMetrics`(DART 소유보고·거래계획)를 줄로 옮긴다.
 */
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatInteger,
    formatSignedCompact,
    formatSignedPercent,
} from '../flowFormat';
import { presentLines, type AxisEvidenceLine } from './evidenceLine';
import { batchFilingNote } from './krBatchFiling';
import { isMeasuredNoChange } from './measuredNoChange';

/** 소유비율 증감(%p)의 소수 자리 — DART가 소수 둘째 자리까지 준다. */
const NET_PCT_DIGITS = 2;

/** 소유보고 건수(하루 일괄 보고면 그 주석 포함)·변동 없음·순 주식 증감·순 비율·거래계획 근거. */
export function krInsiderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.insider.krMetrics;
    if (m === undefined) return [];
    const days = formatInteger(scorecard.freshness.insiderWindow.days, locale);
    const batch = batchFilingNote(m, locale);
    return presentLines([
        {
            id: batch === null ? 'krInsiderReports' : 'krInsiderReportsBatch',
            values: {
                days,
                reports: formatInteger(m.reports, locale),
                reporters: formatInteger(m.reporters, locale),
                ...batch,
            },
        },
        isMeasuredNoChange(scorecard.insider.signals)
            ? { id: 'krInsiderNoChange', values: {} }
            : null,
        {
            id: 'krInsiderNetShares',
            values: { shares: formatSignedCompact(m.netSharesChange, locale) },
        },
        m.netChangePct === null
            ? null
            : {
                  id: 'krInsiderNetPct',
                  values: {
                      pct: formatSignedPercent(
                          m.netChangePct,
                          locale,
                          NET_PCT_DIGITS
                      ),
                  },
              },
        m.tradingPlans === 0
            ? null
            : {
                  id: 'krTradingPlans',
                  values: { count: formatInteger(m.tradingPlans, locale) },
              },
    ]);
}
