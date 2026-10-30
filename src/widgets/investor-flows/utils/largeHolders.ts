/**
 * 대량보유(13D·13G) 공시 목록의 행 선택·분류·표시 규칙.
 */
import type { LargeHolderFiling } from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

/** 대량보유 목록에 싣는 최대 건수(최신 제출순). */
export const MAX_LARGE_HOLDER_ROWS = 8;

/** 대량보유 공시 종류. */
export type LargeHolderKind = '13d' | '13g' | 'other';

/** 종류 배지 색 — 13D(행동주의·경영 참여 가능)는 경고 톤, 나머지는 중립 톤. */
export const KIND_CLASS: Record<LargeHolderKind, string> = {
    '13d': 'bg-ui-warning/10 text-ui-warning-text',
    '13g': 'bg-secondary-700 text-secondary-300',
    other: 'bg-secondary-700 text-secondary-300',
};

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

/** 같은 날 같은 양식이 여러 건일 수 있어 신고인과 원문 주소까지 키에 넣는다. */
export function largeHolderKey(filing: LargeHolderFiling): string {
    return `${filing.filingDate}-${filing.filer}-${filing.form}-${filing.url}`;
}
