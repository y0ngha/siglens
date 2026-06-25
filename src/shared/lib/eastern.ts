// EDT: 3월 두 번째 일요일 02:00 ~ 11월 첫 번째 일요일 02:00 → UTC-4 (IANA America/New_York)
// EST: 그 외 구간 → UTC-5
// month은 JS Date 0-indexed 기준 (0 = January)
export const MARCH = 2; // 0-indexed
export const NOVEMBER = 10; // 0-indexed

export const SECOND_SUNDAY = 2;
export const FIRST_SUNDAY = 1;

// DST 전환은 현지 02:00에 발생한다:
// Spring (EST → EDT): 현지 02:00 EST = UTC 07:00
// Fall  (EDT → EST):  현지 02:00 EDT = UTC 06:00
const DST_START_UTC_HOUR = 7;
const DST_END_UTC_HOUR = 6;
const DAYS_IN_WEEK = 7;

export const EDT_OFFSET_HOURS = -4 as const;
export const EST_OFFSET_HOURS = -5 as const;

/**
 * 해당 연도·월(0-indexed)의 N번째 일요일의 날짜(day-of-month)를 반환하는 정규 원시 함수.
 *
 * 세 DST 구현(eastern.ts, etTimeUtils.ts, FmpMarketProvider.ts)의 공통 기반이다.
 * etTimeUtils.getEtOffset와 FmpMarketProvider.getEtOffsetHours는 이 함수를 위임해 사용한다.
 *
 * @param year  - 연도
 * @param month - 0-indexed 월 (0 = January)
 * @param nth   - 1-indexed 번째 일요일
 * @returns 1-indexed 날짜(day-of-month)
 */
export function nthSundayDay(year: number, month: number, nth: number): number {
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const firstSundayOffset =
        (DAYS_IN_WEEK - firstDayOfMonth.getUTCDay()) % DAYS_IN_WEEK;
    return 1 + firstSundayOffset + (nth - 1) * DAYS_IN_WEEK;
}

/**
 * UTC 순간(Date 객체)을 받아 해당 시점의 Eastern Time UTC 오프셋을 반환한다.
 *
 * UTC 기준 비교를 사용하므로 nthSundayDay로 날짜를 구한 후
 * DST 전환 UTC 시각(07:00 / 06:00)을 합산해 정확한 경계를 계산한다.
 */
export function getEasternOffsetHours(utcDate: Date): -4 | -5 {
    const year = utcDate.getUTCFullYear();
    const springDay = nthSundayDay(year, MARCH, SECOND_SUNDAY);
    const fallDay = nthSundayDay(year, NOVEMBER, FIRST_SUNDAY);

    // UTC 순간으로 경계 계산: 전환은 각각 UTC 07:00, 06:00에 발생
    // Date 객체 할당 없이 원시 ms 비교로 동일 결과 (호출 당 GC 압력 최소화)
    const dstStartMs = Date.UTC(year, MARCH, springDay, DST_START_UTC_HOUR);
    const dstEndMs = Date.UTC(year, NOVEMBER, fallDay, DST_END_UTC_HOUR);

    const timeMs = utcDate.getTime();
    const isEDT = timeMs >= dstStartMs && timeMs < dstEndMs;
    return isEDT ? EDT_OFFSET_HOURS : EST_OFFSET_HOURS;
}
