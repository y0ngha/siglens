/**
 * 기관(13F) 축의 근거 줄 — 점수표 `institutional.metrics`를 줄로 옮긴다.
 */
import type {
    InvestorFlowsScorecard,
    NetShareChangeBasis,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatDecimal,
    formatInteger,
    formatSignedPercent,
} from '../flowFormat';
import { presentLines, type AxisEvidenceLine } from './evidenceLine';

/** 순매수 비율의 분모에 따라 문구가 다르다 — 직전 보유 대비인지, 발행주식 대비인지. */
const NET_SHARES_EVIDENCE_ID: Record<NetShareChangeBasis, string> = {
    priorHoldings: 'netSharesPrior',
    sharesOutstanding: 'netSharesOutstanding',
};

/** 순변화 비율·풋/콜 비율의 소수 자리. */
const RATIO_DIGITS = 2;

/** 보유 기관 수·순매수·신규/이탈·풋콜 비율 근거. 값이 없는 줄은 만들지 않는다. */
export function institutionalLines(
    scorecard: InvestorFlowsScorecard,
    locale: Locale
): AxisEvidenceLine[] {
    const m = scorecard.institutional.metrics;
    const netSharesId =
        NET_SHARES_EVIDENCE_ID[m.netShareChangeBasis ?? 'sharesOutstanding'];
    return presentLines([
        m.holders === null
            ? null
            : {
                  id:
                      m.holderCountChangePct === null
                          ? 'holdersOnly'
                          : 'holders',
                  values: {
                      count: formatInteger(m.holders, locale),
                      change:
                          m.holderCountChangePct === null
                              ? ''
                              : formatSignedPercent(
                                    m.holderCountChangePct,
                                    locale
                                ),
                  },
              },
        m.netShareChangePct === null
            ? null
            : {
                  id: netSharesId,
                  values: {
                      pct: formatSignedPercent(
                          m.netShareChangePct,
                          locale,
                          RATIO_DIGITS
                      ),
                  },
              },
        m.newHolders === null || m.exited === null
            ? null
            : {
                  id: 'newExited',
                  values: {
                      added: formatInteger(m.newHolders, locale),
                      exited: formatInteger(m.exited, locale),
                  },
              },
        m.putCallValueRatio === null
            ? null
            : {
                  id: 'putCallRatio',
                  values: {
                      ratio: formatDecimal(
                          m.putCallValueRatio,
                          locale,
                          RATIO_DIGITS
                      ),
                  },
              },
    ]);
}
