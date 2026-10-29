/**
 * @file 리포트 대상 미리보기(`ReportSymbolsPreview`)가 위에 보일 요약 문장의 종류와, 지운 종목
 * 기록 안내에 넣는 제외 상한.
 */

import { EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS } from '@/entities/email-report/lib/emailReportConstants';

/** 미리보기 그룹별 종목 수 — 요약 문장 고르기에 필요한 것만. */
export interface ReportPreviewCounts {
    readonly full: number;
    readonly brief: number;
    readonly excluded: number;
}

/**
 * 미리보기 위 요약 문장. `counts`: 담기는 종목이 있다. `allExcluded`: 담을 종목을 모두 뺐다
 * (다시 넣을 수 있다). `empty`: 보유·관심종목이 없다. 목록에서 이미 지운 종목의 제외 기록은
 * 다시 넣을 대상이 아니라 `allExcluded`로 세지 않는다.
 */
export type ReportPreviewSummary =
    | {
          readonly kind: 'counts';
          readonly total: number;
          readonly full: number;
          readonly brief: number;
      }
    | { readonly kind: 'allExcluded' }
    | { readonly kind: 'empty' };

/** 그룹별 종목 수에서 [[ReportPreviewSummary]]를 고른다. */
export function summarizeReportPreview(
    counts: ReportPreviewCounts
): ReportPreviewSummary {
    const total = counts.full + counts.brief;
    if (total > 0) {
        return {
            kind: 'counts',
            total,
            full: counts.full,
            brief: counts.brief,
        };
    }
    if (counts.excluded > 0) return { kind: 'allExcluded' };
    return { kind: 'empty' };
}

/**
 * 지운 종목의 제외 기록 안내에 보이는 한도 — 기록이 이 상한을 차지한다는 것을 알려 지우게 한다.
 * 액션(`excludeReportSymbolAction`)이 같은 상수로 막는다.
 */
export const STALE_EXCLUDED_NOTICE_LIMIT = EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS;
