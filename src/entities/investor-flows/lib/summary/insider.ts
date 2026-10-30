import type {
    InsiderTransaction,
    LargeHolderFiling,
    ProposedSale,
} from '@y0ngha/siglens-core';
import { ISO_DATE_LENGTH } from '@/shared/config/time';
import { compareIsoDate } from '../investorFlowsDates';
import { proposedSaleCountWindows } from '../snapshot/filings';
import type { ProposedSaleFormType, ProposedSaleWithForm } from '../../model';
import type {
    SummaryTransaction,
    SummaryLargeHolder,
    SummaryProposedSale,
    SummaryProposedSaleCounts,
} from './types';
import {
    SUMMARY_NAME_MAX_CHARS,
    SUMMARY_ROLE_MAX_CHARS,
    clipSummaryText,
} from './format';

/** 요약에 싣는 최근 내부자 거래 건수 상한. */
export const SUMMARY_MAX_INSIDER_TRANSACTIONS = 6;
/** 요약에 싣는 최근 13D/G 신고 건수 상한. */
export const SUMMARY_MAX_LARGE_HOLDERS = 3;

/** Form 144·증자 공시는 최근 5건씩(설계 §2.5). */
export const SUMMARY_MAX_PROPOSED_SALES = 5;

/** 내부자 거래 한 건을 요약 칸으로 줄인다 — 이름·직함은 한 줄로 펴서 자른다. */
export function summarizeTransaction(
    tx: InsiderTransaction
): SummaryTransaction {
    return {
        date: tx.date,
        name: clipSummaryText(tx.name, SUMMARY_NAME_MAX_CHARS),
        role: clipSummaryText(tx.role, SUMMARY_ROLE_MAX_CHARS),
        type: tx.type,
        valueUsd: tx.value,
    };
}

/** 13D/G 신고 한 건을 요약 칸으로 줄인다 — 신고자 이름은 한 줄로 펴서 자른다. */
export function summarizeLargeHolder(
    filing: LargeHolderFiling
): SummaryLargeHolder {
    return {
        filingDate: filing.filingDate,
        filer: clipSummaryText(filing.filer, SUMMARY_NAME_MAX_CHARS),
        form: filing.form,
        percentOfClass: filing.percentOfClass,
    };
}

/** 옛 캐시 스냅샷에는 양식 필드가 없다 — 정정이라는 증거가 없으면 원본으로 센다. */
function proposedSaleForm(sale: ProposedSale): ProposedSaleFormType {
    return hasFormType(sale) && sale.formType === '144/A' ? '144/A' : '144';
}

/** 양식 필드를 가진(= 새 스냅샷의) 행인가. 옛 캐시 스냅샷의 행은 아니다. */
function hasFormType(sale: ProposedSale): sale is ProposedSaleWithForm {
    return (
        'formType' in sale &&
        (sale.formType === '144' || sale.formType === '144/A')
    );
}

/**
 * 스냅샷의 전체 Form 144 행(상한 5건으로 자르기 전)에서 원본 신고만 세어 창별 건수를 만든다.
 *
 * `windowTo`는 스냅샷 기준일(`asOf`, UTC 날짜)이 주말이면 직전 금요일로 당긴 날짜다 — 가장 최근 거래일을 포함하는 창이
 * 되도록 하기 위함이며, 미국 휴장일은 모른다(공휴일 다음 날이면 휴장일이 `windowTo`가 될 수 있다).
 */
export function countProposedSales(
    sales: readonly ProposedSale[],
    asOf: string
): SummaryProposedSaleCounts {
    const { windowTo, last30dFrom, last90dFrom } = proposedSaleCountWindows(
        asOf.slice(0, ISO_DATE_LENGTH)
    );
    const originals = sales.filter(sale => proposedSaleForm(sale) === '144');
    const countFrom = (from: string): number =>
        originals.filter(
            sale =>
                compareIsoDate(sale.filingDate, from) >= 0 &&
                compareIsoDate(sale.filingDate, windowTo) <= 0
        ).length;
    return {
        last30d: countFrom(last30dFrom),
        last90d: countFrom(last90dFrom),
        windowTo,
        last30dFrom,
        last90dFrom,
        // 양식 필드가 없는 행(옛 캐시 스냅샷)은 정정 여부를 알 수 없어 원본으로 셌다 — 그땐 정정 제외를 약속하지 않는다.
        excludesAmendments: sales.every(hasFormType),
    };
}

/** Form 144 신고 한 건을 요약 칸으로 줄인다. 10b5-1 여부는 계획 채택일의 유무로 정한다. */
export function summarizeProposedSale(sale: ProposedSale): SummaryProposedSale {
    return {
        formType: proposedSaleForm(sale),
        filingDate: sale.filingDate,
        filer: clipSummaryText(sale.filer, SUMMARY_NAME_MAX_CHARS),
        relationships: clipSummaryText(
            sale.relationships.join(', '),
            SUMMARY_ROLE_MAX_CHARS
        ),
        shares: sale.shares,
        valueUsd: sale.valueUsd,
        plan10b5_1: sale.planAdoptionDate !== null,
    };
}
