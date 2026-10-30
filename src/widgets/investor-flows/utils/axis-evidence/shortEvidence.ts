/**
 * 공매도 축의 근거 줄 — 점수표 `short.metrics`(FINRA 잔고·일별 비중, SEC 결제 불이행, 과열 목록)를 줄로 옮긴다.
 */
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { ftdPctDigits } from '../failsToDeliver';
import {
    formatDecimal,
    formatInteger,
    formatPercent,
    formatSignedPercent,
    formatSmallPercent,
} from '../flowFormat';
import { presentLines, type AxisEvidenceLine } from './evidenceLine';
import { PERCENT_SCALE } from '../percentScale';

/** 유통주식 대비 공매도 잔고 %의 소수 자리. */
const SHORT_PCT_DIGITS = 2;
/** 일별 공매도 거래 비중 %의 소수 자리. */
const SHORT_RATIO_DIGITS = 1;
/** 상환일수의 소수 자리. */
const DAYS_TO_COVER_DIGITS = 1;

/** 잔고 %·상환일수·잔고 추세·일별 비중·결제 불이행·과열 목록 근거. 값이 없는 줄은 만들지 않는다. */
export function shortLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.short.metrics;
    return presentLines([
        m.shortInterestPctFloat === null
            ? null
            : {
                  id: 'shortPct',
                  values: {
                      pct: formatPercent(
                          m.shortInterestPctFloat,
                          locale,
                          SHORT_PCT_DIGITS
                      ),
                  },
              },
        m.daysToCover === null
            ? null
            : {
                  id: 'daysToCover',
                  values: {
                      days: formatDecimal(
                          m.daysToCover,
                          locale,
                          DAYS_TO_COVER_DIGITS
                      ),
                  },
              },
        m.shortInterestChangePct === null
            ? null
            : {
                  id: 'shortTrend',
                  values: {
                      pct: formatSignedPercent(
                          m.shortInterestChangePct,
                          locale
                      ),
                  },
              },
        m.shortVolumeRatio === null
            ? null
            : {
                  id: 'shortRatio',
                  values: {
                      pct: formatPercent(
                          m.shortVolumeRatio * PERCENT_SCALE,
                          locale,
                          SHORT_RATIO_DIGITS
                      ),
                  },
              },
        m.failsToDeliverPctOutstanding === null
            ? null
            : {
                  id: 'ftdPct',
                  values: {
                      // 결제 불이행 블록과 같은 포매터·자리 규칙 — 대형주의 아주 작은 값이 `0.00%`로 뭉개지지 않는다.
                      pct: formatSmallPercent(
                          m.failsToDeliverPctOutstanding,
                          locale,
                          ftdPctDigits(m.failsToDeliverPctOutstanding)
                      ),
                  },
              },
        m.thresholdListed === true && m.thresholdConsecutiveDays !== null
            ? {
                  id: 'thresholdListed',
                  values: {
                      days: formatInteger(m.thresholdConsecutiveDays, locale),
                  },
              }
            : null,
    ]);
}
