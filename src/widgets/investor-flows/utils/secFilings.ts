import type {
    OfferingFiling,
    OfferingKind,
    ProposedSale,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

/** 매도 예정 신고(Form 144) 목록에 싣는 최대 건수(최신 신고일 순). */
export const MAX_PROPOSED_SALE_ROWS = 10;
/** 증자·희석 공시 목록에 싣는 최대 건수(최신 신고일 순). */
export const MAX_OFFERING_ROWS = 10;

export interface LimitedRows<T> {
    rows: T[];
    /** 상한 밖이라 목록에서 뺀 건수. */
    omittedCount: number;
}

function newestFirst<T extends { readonly filingDate: string }>(
    items: readonly T[],
    max: number
): LimitedRows<T> {
    const sorted = items.toSorted((a, b) =>
        compareIsoDate(b.filingDate, a.filingDate)
    );
    return {
        rows: sorted.slice(0, max),
        omittedCount: Math.max(0, sorted.length - max),
    };
}

export function buildProposedSaleRows(
    sales: readonly ProposedSale[]
): LimitedRows<ProposedSale> {
    return newestFirst(sales, MAX_PROPOSED_SALE_ROWS);
}

export function buildOfferingRows(
    filings: readonly OfferingFiling[]
): LimitedRows<OfferingFiling> {
    return newestFirst(filings, MAX_OFFERING_ROWS);
}

/** 배지 톤 — 실제로 주식을 파는 공시(ATM·인수·모집 주선)는 경고 톤, 등록·사모·설명서는 중립 톤. */
export type OfferingTone = 'issuance' | 'neutral';

export const OFFERING_TONE: Record<OfferingKind, OfferingTone> = {
    atm: 'issuance',
    underwritten: 'issuance',
    best_efforts: 'issuance',
    shelf: 'neutral',
    registration: 'neutral',
    private_placement: 'neutral',
    prospectus: 'neutral',
    other: 'neutral',
};

/** 같은 날 같은 양식이 여러 건일 수 있어 URL까지 키에 넣는다. */
export function offeringKey(filing: OfferingFiling): string {
    return `${filing.filingDate}-${filing.form}-${filing.url}`;
}

export function proposedSaleKey(sale: ProposedSale): string {
    return `${sale.filingDate}-${sale.filer}-${sale.shares}-${sale.url}`;
}
