import type { InsiderTransaction } from '@y0ngha/siglens-core';

/** 거래 표에 싣는 최대 건수(매수·매도만, 최신순). */
export const MAX_INSIDER_ROWS = 15;

export interface InsiderTableData {
    rows: InsiderTransaction[];
    /** 표에서 뺀 `other`(증여·옵션 행사 등 장내 매수·매도가 아닌 신고) 건수. */
    omittedOtherCount: number;
}

/**
 * 거래 표 데이터. 장내 매수(`buy`)·매도(`sell`)만 싣고 나머지(`other`)는 건수로만 알린다 — 증여·옵션
 * 행사·세금 원천징수가 섞이면 "내부자가 샀다/팔았다"를 읽을 수 없다. 최신 거래일 순.
 */
export function buildInsiderTable(
    transactions: readonly InsiderTransaction[]
): InsiderTableData {
    const sorted = [...transactions].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0
    );
    const traded = sorted.filter(tx => tx.type !== 'other');
    return {
        rows: traded.slice(0, MAX_INSIDER_ROWS),
        omittedOtherCount: sorted.length - traded.length,
    };
}

/** 직무 문자열을 짧게. FMP는 `officer: Chief Executive Officer`처럼 접두사를 붙인다. */
export function shortRole(role: string): string {
    const trimmed = role.trim();
    const colon = trimmed.indexOf(':');
    return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
}
