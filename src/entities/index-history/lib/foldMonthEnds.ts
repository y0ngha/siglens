import type { MonthEndClose } from '@y0ngha/siglens-core';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 일봉 종가(`date`는 거래소 현지 `YYYY-MM-DD`)를 달마다 마지막 거래일 종가 하나로 접는다(오래된 달 먼저).
 * 입력 순서는 가리지 않는다 — 같은 달 안에서는 날짜가 가장 늦은 행이 이긴다. 날짜·종가가 이상한 행은 버린다.
 */
export function foldDailyToMonthEnds(
    rows: readonly { date: string; close: number }[]
): MonthEndClose[] {
    const valid = rows
        .filter(
            row =>
                ISO_DATE.test(row.date) &&
                Number.isFinite(row.close) &&
                row.close > 0
        )
        .toSorted((a, b) => a.date.localeCompare(b.date));
    // 날짜순으로 넣으면 같은 달의 마지막(가장 늦은) 행이 남는다 — Map 생성자는 같은 키의 뒤 항목으로 덮는다.
    const lastByMonth = new Map(
        valid.map(row => [row.date.slice(0, 7), row.close] as const)
    );
    return [...lastByMonth.entries()]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([month, close]) => ({ month, close }));
}
