import type {
    EarningsReportComparisonItem,
    EarningsReportComparisonSlot,
    EarningsReportPeriod,
} from '@/shared/lib/types';
import type { EarningsReportDataRow } from '../model';
import { toNumberOrNull } from './earningsRowMapping';

/**
 * 실적 행에서 뉴스 페이지 비교 카드용 항목을 고른다. 예정(추정치만 있는) 행이 있으면
 * 직전 발표 2건 + 예정 1건, 없으면 최근 발표 3건을 오래된 순서로 슬롯에 배정한다.
 * `today`(KST `YYYY-MM-DD`)는 호출자가 주입한다.
 */
export function toComparisonItems(
    rows: EarningsReportDataRow[],
    today: string
): EarningsReportComparisonItem[] {
    const completed = rows
        .filter(row => row.earningsDate <= today && hasActualValue(row))
        .toSorted(compareEarningsDateDesc);
    const upcoming = rows
        .filter(
            row =>
                row.earningsDate >= today &&
                !hasActualValue(row) &&
                hasEstimateValue(row)
        )
        .toSorted(compareEarningsDateAsc);

    if (upcoming.length > 0) {
        return [
            ...assignPastSlots(completed.slice(0, 2).toReversed()),
            toComparisonItem(upcoming[0], 'future', 'recent-or-future'),
        ];
    }

    return assignTrailingSlots(completed.slice(0, 3).toReversed());
}

function assignPastSlots(
    rows: EarningsReportDataRow[]
): EarningsReportComparisonItem[] {
    const slots: EarningsReportComparisonSlot[] =
        rows.length === 1 ? ['past-1'] : ['past-2', 'past-1'];

    return rows.map((row, index) =>
        toComparisonItem(row, 'past', slots[index])
    );
}

function assignTrailingSlots(
    rows: EarningsReportDataRow[]
): EarningsReportComparisonItem[] {
    const slotsByLength: Record<number, EarningsReportComparisonSlot[]> = {
        0: [],
        1: ['recent-or-future'],
        2: ['past-1', 'recent-or-future'],
        3: ['past-2', 'past-1', 'recent-or-future'],
    };
    const slots = slotsByLength[rows.length] ?? slotsByLength[0];

    return rows.map((row, index) =>
        toComparisonItem(row, 'past', slots[index])
    );
}

function toComparisonItem(
    row: EarningsReportDataRow,
    period: EarningsReportPeriod,
    slot: EarningsReportComparisonSlot
): EarningsReportComparisonItem {
    return {
        symbol: row.symbol,
        earningsDate: row.earningsDate,
        epsActual: toNumberOrNull(row.epsActual),
        epsEstimated: toNumberOrNull(row.epsEstimated),
        revenueActual: toNumberOrNull(row.revenueActual),
        revenueEstimated: toNumberOrNull(row.revenueEstimated),
        lastUpdated: row.lastUpdated,
        period,
        slot,
    };
}

function hasActualValue(row: EarningsReportDataRow): boolean {
    return row.epsActual !== null || row.revenueActual !== null;
}

function hasEstimateValue(row: EarningsReportDataRow): boolean {
    return row.epsEstimated !== null || row.revenueEstimated !== null;
}

function compareEarningsDateAsc(
    a: EarningsReportDataRow,
    b: EarningsReportDataRow
): number {
    return a.earningsDate.localeCompare(b.earningsDate);
}

function compareEarningsDateDesc(
    a: EarningsReportDataRow,
    b: EarningsReportDataRow
): number {
    return b.earningsDate.localeCompare(a.earningsDate);
}
