import type { InstitutionalOptionsQuarter } from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

/** 옵션 포지션 목록에 싣는 분기 수(최신 분기부터). */
export const OPTIONS_QUARTERS_SHOWN = 4;

/**
 * 13F 옵션(풋·콜 명목) 분기 행 — 최신 분기부터 `OPTIONS_QUARTERS_SHOWN`개. 풋도 콜도 0인 분기는 뺀다(보고가 없던 분기를
 * "0달러"로 그리지 않는다).
 */
export function buildOptionsRows(
    quarters: readonly InstitutionalOptionsQuarter[]
): InstitutionalOptionsQuarter[] {
    return quarters
        .filter(q => q.putValueUsd > 0 || q.callValueUsd > 0)
        .toSorted((a, b) => compareIsoDate(b.period, a.period))
        .slice(0, OPTIONS_QUARTERS_SHOWN);
}
