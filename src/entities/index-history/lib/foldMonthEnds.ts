import type { MonthEndClose } from '@y0ngha/siglens-core';

/**
 * 일봉 종가(`date`는 거래소 현지 `YYYY-MM-DD`)를 달마다 마지막 거래일 종가 하나로 접는다(오래된 달 먼저).
 * 입력 순서는 가리지 않는다 — 같은 달 안에서는 날짜가 가장 늦은 행이 이긴다. 날짜·종가가 이상한 행은 버린다.
 */
export function foldDailyToMonthEnds(
    rows: readonly { date: string; close: number }[]
): MonthEndClose[] {
    const last = new Map<string, { date: string; close: number }>();
    for (const row of rows) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
        if (!Number.isFinite(row.close) || row.close <= 0) continue;
        const month = row.date.slice(0, 7);
        const seen = last.get(month);
        if (seen === undefined || row.date > seen.date) last.set(month, row);
    }
    return [...last.entries()]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([month, row]) => ({ month, close: row.close }));
}
