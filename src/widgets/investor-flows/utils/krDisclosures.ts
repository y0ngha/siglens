import type {
    KrInsiderReport,
    KrMajorHolderReport,
    KrTradingPlan,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';
import type { LimitedRows } from './secFilings';

/** 대량보유·소유보고·거래계획 표에 싣는 최대 건수(최신 접수일 순). */
export const MAX_KR_DISCLOSURE_ROWS = 10;

/** 최신 접수일 순으로 `MAX_KR_DISCLOSURE_ROWS`건까지. 같은 날은 원래 순서(저장소의 접수번호 역순)를 지킨다. */
export function newestKrRows<T extends { readonly receiptDate: string }>(
    rows: readonly T[]
): LimitedRows<T> {
    const sorted = rows.toSorted((a, b) =>
        compareIsoDate(b.receiptDate, a.receiptDate)
    );
    return {
        rows: sorted.slice(0, MAX_KR_DISCLOSURE_ROWS),
        omittedCount: Math.max(0, sorted.length - MAX_KR_DISCLOSURE_ROWS),
    };
}

/** 한 접수번호에 보고자가 여럿일 수 있어(공동 보고) 보고자까지 키에 넣는다. */
export function majorHolderKey(row: KrMajorHolderReport): string {
    return `${row.url}-${row.reporter}`;
}

export function insiderReportKey(row: KrInsiderReport): string {
    return `${row.url}-${row.reporter}`;
}

export function tradingPlanKey(row: KrTradingPlan): string {
    return `${row.url}-${row.reporter}`;
}
