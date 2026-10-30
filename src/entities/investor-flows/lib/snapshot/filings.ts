import type { OfferingFiling } from '@y0ngha/siglens-core';
import type {
    ProposedSaleWithForm,
    OfferingRecord,
    ProposedSaleRecord,
} from '../../model';
import {
    addDays,
    compareIsoDate,
    latestWeekdayOnOrBefore,
} from '../investorFlowsDates';

/** Form 144는 약 1년치(core 계약, 저장 보존 기간과 같다). 대형주도 1년 수십 건이다. */
export const PROPOSED_SALE_LOOKBACK_DAYS = 365;

/** 스냅샷에 담는 Form 144 신고 수 상한 — 90일 건수 창 안의 행은 이 상한을 넘어도 남긴다(`buildProposedSales`). */
export const SNAPSHOT_MAX_PROPOSED_SALES = 60;

/**
 * Form 144 건수 창(달력일, 마지막 날 포함) — 에이전트 도구의 `proposedSalesCounts.last30d/last90d`.
 * 스냅샷은 신고가 많은 종목에서도 이 창 안의 행을 상한(60)에 잘리지 않게 전부 담는다(`buildProposedSales`).
 */
export const PROPOSED_SALE_COUNT_SHORT_DAYS = 30;

/** Form 144 건수의 긴 창(달력일) — 짧은 창은 `PROPOSED_SALE_COUNT_SHORT_DAYS`. */
export const PROPOSED_SALE_COUNT_LONG_DAYS = 90;

/** 증자·희석 공시는 약 2년치(core 계약). */
export const OFFERING_LOOKBACK_DAYS = 730;

/** 스냅샷에 담는 증자·희석 공시 수 상한(최신순). */
export const SNAPSHOT_MAX_OFFERINGS = 40;

/**
 * Form 144 건수 창의 경계 — 스냅샷 기준일(UTC 날짜)이 주말이면 직전 금요일로 당긴 `windowTo`와 거기서 뺀 창 시작일.
 * 상한 면제 범위(`buildProposedSales`)와 실제로 세는 범위(`countProposedSales`)가 같은 경계를 쓰도록 한 곳에서 만든다.
 * 미국 휴장일은 모른다.
 */
export function proposedSaleCountWindows(asOfDate: string): {
    windowTo: string;
    last30dFrom: string;
    last90dFrom: string;
} {
    const windowTo = latestWeekdayOnOrBefore(asOfDate);
    return {
        windowTo,
        last30dFrom: addDays(windowTo, -(PROPOSED_SALE_COUNT_SHORT_DAYS - 1)),
        last90dFrom: addDays(windowTo, -(PROPOSED_SALE_COUNT_LONG_DAYS - 1)),
    };
}

/** 최신 신고일 먼저 — 상한으로 자를 때 오래된 쪽을 버린다. 단, 90일 건수 창 안의 행은 상한을 넘어도 남긴다. */
export function buildProposedSales(
    rows: readonly ProposedSaleRecord[],
    today: string
): ProposedSaleWithForm[] {
    const sorted = rows.toSorted((a, b) =>
        compareIsoDate(b.filingDate, a.filingDate)
    );
    const { last90dFrom: longWindowFrom } = proposedSaleCountWindows(today);
    const inLongWindow = sorted.filter(
        row => compareIsoDate(row.filingDate, longWindowFrom) >= 0
    ).length;
    return sorted
        .slice(0, Math.max(SNAPSHOT_MAX_PROPOSED_SALES, inLongWindow))
        .map(row => ({
            // 정정(`144/A`)은 건수에서 빼야 해서 양식을 끝까지 들고 간다. core 타입에는 없는 필드다.
            formType: row.formType === '144/A' ? '144/A' : '144',
            filingDate: row.filingDate,
            filer: row.filer,
            filerCik: row.filerCik,
            relationships: row.relationships,
            shares: row.shares,
            valueUsd: row.valueUsd,
            approxSaleDate: row.approxSaleDate,
            planAdoptionDate: row.planAdoptionDate,
            url: row.url,
        }));
}

/** 증자·희석 공시 행 → 최근순 `SNAPSHOT_MAX_OFFERINGS`건의 core 타입. */
export function buildOfferings(
    rows: readonly OfferingRecord[]
): OfferingFiling[] {
    return rows
        .toSorted((a, b) => compareIsoDate(b.filingDate, a.filingDate))
        .slice(0, SNAPSHOT_MAX_OFFERINGS)
        .map(row => ({
            filingDate: row.filingDate,
            form: row.formType,
            kind: row.kind,
            url: row.url,
        }));
}
