/**
 * 대량보유 축의 근거 줄 — 미국은 13D/13G 지표, 한국은 DART 대량보유 지표로 만든다.
 */
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { formatInteger } from '../flowFormat';
import type { AxisEvidenceLine } from './evidenceLine';
import { krLargeHolderLines } from './krLargeHolderEvidence';

/**
 * 한국은 DART 대량보유 근거, 미국은 13D/13G 건수 한 줄이다. 포지션(`events*`: 신고인별 정정 접기·공동 신고 병합 후)과
 * 신고(`filings*`: 원본·정정 건수)는 다르다 — 한 보유자의 13D/A 일곱 건은 포지션 1·신고 7이다. 신고 수를 보유자 수로 읽지
 * 않게 둘을 함께 보인다.
 */
export function largeHolderLines(
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
