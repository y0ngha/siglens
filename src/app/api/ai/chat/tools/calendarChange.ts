import 'server-only';
import type { Bar } from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { pctVs } from './percent';

/**
 * A return measured from a CALENDAR date, not a bar count: the last close vs
 * the close of the last session on or before "last session's date minus N
 * calendar months". `baseDate`/`baseClose` name that session so the model can
 * say which day the period starts on.
 */
export interface CalendarChange {
    baseDate: string;
    baseClose: number;
    pct: number | null;
}

/**
 * `get_bars_indicators`' `derived.calendarChange`. Separate from the bar-count
 * `changePct['20bars'|'60bars'|'252bars']` because a real turn read `20bars`
 * as "1개월" and `60bars` as "3개월" (dev-2026-10-22 A10): 20 sessions is not
 * a calendar month, and the two differ by whole percentage points on a
 * trending stock. `null` per entry when the loaded series does not reach back
 * that far.
 */
export interface CalendarChangeView {
    '1month': CalendarChange | null;
    '3months': CalendarChange | null;
    '1year': CalendarChange | null;
}

const CALENDAR_CHANGE_MONTHS: Record<keyof CalendarChangeView, number> = {
    '1month': 1,
    '3months': 3,
    '1year': 12,
};

const MONTHS_PER_YEAR = 12;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * `YYYY-MM-DD` minus `months` calendar months, with the day clamped to the
 * target month's length (03-31 minus 1 month → 02-28/29; a leap day minus a
 * year → 02-28). Pure string/UTC arithmetic, so no timezone can shift it.
 */
export function minusCalendarMonths(isoDate: string, months: number): string {
    const [year, month, day] = isoDate.split('-').map(Number) as [
        number,
        number,
        number,
    ];
    const monthIndex = year * MONTHS_PER_YEAR + (month - 1) - months;
    const targetYear = Math.floor(monthIndex / MONTHS_PER_YEAR);
    const targetMonth = monthIndex - targetYear * MONTHS_PER_YEAR; // 0-based
    // Day 0 of the following month is the last day of `targetMonth`.
    const daysInMonth = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0)
    ).getUTCDate();
    return `${targetYear}-${pad2(targetMonth + 1)}-${pad2(Math.min(day, daysInMonth))}`;
}

/** UTC calendar date of a daily bar — the same date `isoTimestamp(…, '1Day')` prints for it. */
export const barDate = (bar: Bar): string =>
    toUtcIsoDate(new Date(bar.time * MS_PER_SECOND));

/**
 * Index of the last bar dated on or before `targetDate`, or `-1` when the
 * series starts after it (it does not reach back that far). `bars` is
 * oldest-first, so the scan runs from the end.
 */
export function lastIndexOnOrBefore(
    bars: readonly Bar[],
    targetDate: string
): number {
    for (let i = bars.length - 1; i >= 0; i--) {
        if (barDate(bars[i]!) <= targetDate) return i;
    }
    return -1;
}

function calendarChange(
    bars: readonly Bar[],
    months: number
): CalendarChange | null {
    const lastBar = bars[bars.length - 1];
    if (lastBar === undefined) return null;
    const target = minusCalendarMonths(barDate(lastBar), months);
    const baseIndex = lastIndexOnOrBefore(bars, target);
    // `-1`: the series begins after the target date. The last bar itself can
    // never qualify (it is dated after the target), so a hit is always older.
    if (baseIndex < 0) return null;
    const base = bars[baseIndex]!;
    if (!Number.isFinite(base.close)) return null;
    return {
        baseDate: barDate(base),
        baseClose: base.close,
        pct: pctVs(lastBar.close, base.close),
    };
}

/** Daily-bar calendar returns for 1 month, 3 months and 1 year. */
export function calendarChangeView(bars: readonly Bar[]): CalendarChangeView {
    return {
        '1month': calendarChange(bars, CALENDAR_CHANGE_MONTHS['1month']),
        '3months': calendarChange(bars, CALENDAR_CHANGE_MONTHS['3months']),
        '1year': calendarChange(bars, CALENDAR_CHANGE_MONTHS['1year']),
    };
}
