/**
 * 증자·희석 축의 근거 줄 — 점수표 `dilution.metrics`(조회 기간의 SEC 공시)를 줄로 옮긴다.
 */
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { formatInteger } from '../flowFormat';
import { presentLines, type AxisEvidenceLine } from './evidenceLine';

/** 공시 건수·ATM/모집 공시 건수 근거. 기록된 공시가 하나도 없으면 "공시 없음" 한 줄이다. */
export function dilutionLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.dilution.metrics;
    if (m === null) return [];
    // 조회 기간 전체에 공시가 하나도 없다(core `noFilingsOnRecord`) — 채점된 중립이다. "0건" 대신 "공시 없음"으로 말한다.
    if (scorecard.dilution.noFilingsOnRecord) {
        return [{ id: 'dilutionNoneOnRecord', values: {} }];
    }
    return presentLines([
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
        m.atmFilings + m.marketedOfferingFilings === 0
            ? null
            : {
                  id: 'dilutionIssuance',
                  values: {
                      atm: formatInteger(m.atmFilings, locale),
                      marketed: formatInteger(
                          m.marketedOfferingFilings,
                          locale
                      ),
                  },
              },
    ]);
}
