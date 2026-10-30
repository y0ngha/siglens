import type { OfferingFiling } from '@y0ngha/siglens-core';
import type { SummaryOffering } from './types';

/** 요약에 싣는 증자·희석 공시 최근 건수 상한. */
export const SUMMARY_MAX_OFFERINGS = 5;

/** 공시 한 건에서 양식·종류만 남긴다(URL 등은 도구 출력에서 뺀다). */
export function summarizeOffering(filing: OfferingFiling): SummaryOffering {
    return {
        filingDate: filing.filingDate,
        form: filing.form,
        kind: filing.kind,
    };
}
