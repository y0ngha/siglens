import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { ResolvedNextEarnings } from '@/entities/analyst-views/lib/resolveNextEarnings';

/**
 * Yahoo 힌트로 대조한 결과(`resolveNextEarnings`)를 분석 입력용 다음 실적 행에 반영한다. 날짜는 대조 결과로 바꾸고,
 * core 계약대로 추정일에만 `dateConfirmed: false`를 싣는다(확정·모름이면 필드를 뺀다). EPS·매출 추정치는 같은 분기라
 * 그대로 둔다.
 */
export function applyResolvedNextEarnings(
    item: EarningsCalendarItem,
    resolved: ResolvedNextEarnings
): EarningsCalendarItem {
    return {
        symbol: item.symbol,
        earningsDate: resolved.date ?? item.earningsDate,
        epsActual: item.epsActual,
        epsEstimated: item.epsEstimated,
        revenueActual: item.revenueActual,
        revenueEstimated: item.revenueEstimated,
        lastUpdated: item.lastUpdated,
        ...(resolved.confirmed === false ? { dateConfirmed: false } : {}),
    };
}
