/**
 * 점수표 축별 근거 수치의 진입점 — 축 id로 축별 모듈을 고른다.
 */
import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { dilutionLines } from './axis-evidence/dilutionEvidence';
import type { AxisEvidenceLine } from './axis-evidence/evidenceLine';
import { insiderLines } from './axis-evidence/insiderEvidence';
import { institutionalLines } from './axis-evidence/institutionalEvidence';
import { largeHolderLines } from './axis-evidence/largeHolderEvidence';
import { shortLines } from './axis-evidence/shortEvidence';

/** 축 id → 그 축의 근거 줄 생성기. 축이 늘면 타입이 누락을 잡는다. */
const EVIDENCE_BUILDERS: Record<
    InvestorFlowsAxisId,
    (scorecard: InvestorFlowsScorecard, locale: Locale) => AxisEvidenceLine[]
> = {
    institutional: institutionalLines,
    insider: insiderLines,
    largeHolders: largeHolderLines,
    short: shortLines,
    dilution: dilutionLines,
};

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
    return EVIDENCE_BUILDERS[axis](scorecard, locale);
}
