import 'server-only';
import {
    calendarPeriodChange,
    type Bar,
    type CalendarPeriodChange,
    type MarketDailyClose,
} from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * A return measured from a CALENDAR date, not a bar count: the last close vs
 * the close of the last session on or before "last session's date minus N
 * calendar months". `baseDate`/`baseClose` name that session so the model can
 * say which day the period starts on.
 */
export type CalendarChange = CalendarPeriodChange;

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

/** UTC calendar date of a daily bar — the same date `isoTimestamp(…, '1Day')` prints for it. */
export const barDate = (bar: Bar): string =>
    toUtcIsoDate(new Date(bar.time * MS_PER_SECOND));

/** A bar as a dated close — the shape core's calendar helpers read. */
const toDatedClose = (bar: Bar): MarketDailyClose => ({
    date: barDate(bar),
    close: bar.close,
});

/**
 * Daily-bar calendar returns for 1 month, 3 months and 1 year, from core's
 * `calendarPeriodChange` — the same base rule and 2-decimal rounding
 * `get_price_stats` uses, so the two tools print one figure for one period.
 * The bars are mapped to dated closes once for the three periods.
 */
export function calendarChangeView(bars: readonly Bar[]): CalendarChangeView {
    const closes = bars.map(toDatedClose);
    return {
        '1month': calendarPeriodChange(
            closes,
            CALENDAR_CHANGE_MONTHS['1month']
        ),
        '3months': calendarPeriodChange(
            closes,
            CALENDAR_CHANGE_MONTHS['3months']
        ),
        '1year': calendarPeriodChange(closes, CALENDAR_CHANGE_MONTHS['1year']),
    };
}
