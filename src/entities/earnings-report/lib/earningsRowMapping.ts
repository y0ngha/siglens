import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { NextEarningsSchedule } from '../model';

/** yahoo 어댑터가 남긴 `rawPayload.isEstimate`를 확정 여부로 바꾼다. 플래그가 없으면 `null`(모름). */
export function dateConfirmedFromPayload(rawPayload: unknown): boolean | null {
    if (
        rawPayload === null ||
        typeof rawPayload !== 'object' ||
        !('isEstimate' in rawPayload)
    ) {
        return null;
    }
    const flag = rawPayload.isEstimate;
    return typeof flag === 'boolean' ? !flag : null;
}

/** core에 넘기는 `EarningsCalendarItem` 필드만 고른다 — 확정 여부(`dateConfirmed`)는 core 계약에 없다. */
export function toCalendarItem(
    schedule: NextEarningsSchedule
): EarningsCalendarItem {
    return {
        symbol: schedule.symbol,
        earningsDate: schedule.earningsDate,
        epsActual: schedule.epsActual,
        epsEstimated: schedule.epsEstimated,
        revenueActual: schedule.revenueActual,
        revenueEstimated: schedule.revenueEstimated,
        lastUpdated: schedule.lastUpdated,
    };
}

/** numeric 컬럼(문자열)을 숫자로 바꾼다. `null`은 그대로 `null`. 레포지토리와 비교 카드 매핑이 공유한다. */
export function toNumberOrNull(value: string | null): number | null {
    return value !== null ? Number(value) : null;
}
