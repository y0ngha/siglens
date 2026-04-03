const MARCH = 2; // 0-indexed
const NOVEMBER = 10; // 0-indexed

const SUNDAY = 0;
const SECOND_SUNDAY = 2;
const FIRST_SUNDAY = 1;

const DST_TRANSITION_HOUR = 2;

const EDT_OFFSET_HOURS = -4 as const;
const EST_OFFSET_HOURS = -5 as const;

function getNthSundayOfMonth(year: number, month: number, n: number): Date {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const dayOfWeek = firstDay.getUTCDay();
    const daysUntilFirstSunday = dayOfWeek === SUNDAY ? 0 : 7 - dayOfWeek;
    const firstSundayDate = 1 + daysUntilFirstSunday;
    const nthSundayDate = firstSundayDate + (n - 1) * 7;
    return new Date(
        Date.UTC(year, month, nthSundayDate, DST_TRANSITION_HOUR, 0, 0)
    );
}

export function getEasternOffsetHours(utcDate: Date): -4 | -5 {
    const year = utcDate.getUTCFullYear();
    const dstStart = getNthSundayOfMonth(year, MARCH, SECOND_SUNDAY);
    const dstEnd = getNthSundayOfMonth(year, NOVEMBER, FIRST_SUNDAY);
    const isEDT = utcDate >= dstStart && utcDate < dstEnd;
    return isEDT ? EDT_OFFSET_HOURS : EST_OFFSET_HOURS;
}
