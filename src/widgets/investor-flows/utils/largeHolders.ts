import type { LargeHolderFiling } from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

export const MAX_LARGE_HOLDER_ROWS = 8;

export type LargeHolderKind = '13d' | '13g' | 'other';

/** 제출 양식 문자열에서 13D(행동주의)·13G(단순투자)를 가른다. 둘 다 아니면 `other`. */
export function largeHolderKind(form: string): LargeHolderKind {
    const normalized = form.toUpperCase();
    if (normalized.includes('13D')) return '13d';
    if (normalized.includes('13G')) return '13g';
    return 'other';
}

/** 최신 제출순 상위 `MAX_LARGE_HOLDER_ROWS`건. */
export function buildLargeHolderRows(
    filings: readonly LargeHolderFiling[]
): LargeHolderFiling[] {
    return filings
        .toSorted((a, b) => compareIsoDate(b.filingDate, a.filingDate))
        .slice(0, MAX_LARGE_HOLDER_ROWS);
}
