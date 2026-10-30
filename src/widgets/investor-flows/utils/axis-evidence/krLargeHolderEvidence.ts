/**
 * 한국 대량보유 축의 근거 줄 — core `largeHolders.krMetrics`(DART 대량보유 보고)를 줄로 옮긴다.
 */
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { formatDecimal, formatInteger } from '../flowFormat';
import { presentLines, type AxisEvidenceLine } from './evidenceLine';
import { isMeasuredNoChange } from './measuredNoChange';

/** 보유비율 최대 변동(%p)의 소수 자리 — DART가 소수 둘째 자리까지 준다. */
const RATIO_CHANGE_DIGITS = 2;

/** 대량보유 보고 건수·보고자, 변동 없음(최대 변동폭), 상세 보고 건수 근거. */
export function krLargeHolderLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.largeHolders.krMetrics;
    if (m === undefined) return [];
    return presentLines([
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
        isMeasuredNoChange(scorecard.largeHolders.signals) &&
        m.maxAbsRatioChangePct !== null
            ? {
                  id: 'krMajorHolderNoChange',
                  values: {
                      pct: formatDecimal(
                          m.maxAbsRatioChangePct,
                          locale,
                          RATIO_CHANGE_DIGITS
                      ),
                  },
              }
            : null,
        m.detailedReports === 0
            ? null
            : {
                  id: 'krMajorHolderDetailed',
                  values: { count: formatInteger(m.detailedReports, locale) },
              },
    ]);
}
