const MARCH = 2; // 0-indexed
const NOVEMBER = 10; // 0-indexed

const SUNDAY = 0;
const SECOND_SUNDAY = 2;
const FIRST_SUNDAY = 1;

// DST transitions occur at local time 02:00:
// Spring (EST → EDT): local 02:00 EST = UTC 07:00
// Fall  (EDT → EST):  local 02:00 EDT = UTC 06:00
const DST_START_UTC_HOUR = 7;
const DST_END_UTC_HOUR = 6;

const EDT_OFFSET_HOURS = -4 as const;
const EST_OFFSET_HOURS = -5 as const;

function getNthSundayOfMonth(
    year: number,
    month: number,
    n: number,
    utcHour: number
): Date {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const dayOfWeek = firstDay.getUTCDay();
    const daysUntilFirstSunday = dayOfWeek === SUNDAY ? 0 : 7 - dayOfWeek;
    const firstSundayDate = 1 + daysUntilFirstSunday;
    const nthSundayDate = firstSundayDate + (n - 1) * 7;
    return new Date(Date.UTC(year, month, nthSundayDate, utcHour, 0, 0));
}

export function getEasternOffsetHours(utcDate: Date): -4 | -5 {
    const year = utcDate.getUTCFullYear();
    const dstStart = getNthSundayOfMonth(
        year,
        MARCH,
        SECOND_SUNDAY,
        DST_START_UTC_HOUR
    );
    const dstEnd = getNthSundayOfMonth(
        year,
        NOVEMBER,
        FIRST_SUNDAY,
        DST_END_UTC_HOUR
    );
    const isEDT = utcDate >= dstStart && utcDate < dstEnd;
    return isEDT ? EDT_OFFSET_HOURS : EST_OFFSET_HOURS;
}
