import {
    computeBarRangeStats,
    type Bar,
    type BarExtreme,
} from '@y0ngha/siglens-core';
import { ratioToPct } from '@/entities/bars/lib/percent';

/**
 * High/low over a window, the bar each was set on, and the last close's
 * distance from each — shared shape for `range` (which also carries `bars`,
 * the window size actually used) and every entry of `ranges`.
 *
 * `highDate`/`lowDate` (dev-2026-10-22 A4): without them a "when was the
 * 52-week low" question had no answer once the low fell outside the returned
 * raw `bars`, and the model borrowed a fear & greed date instead. Same format
 * as the bar timestamps (`YYYY-MM-DD` on 1Day, ISO instant intraday); a tie
 * resolves to the MOST RECENT bar.
 *
 * `high`/`low` are INTRADAY extremes (the bars' high/low). The `*Close`
 * fields are the same window's CLOSING-price extremes ("종가 기준 최고가/최저가")
 * with the same date format, tie rule and distance-from-last-close semantics:
 * a "highest close in 52 weeks" question must read `highClose`, never `high`.
 */
export interface RangeWindow {
    high: number | null;
    highDate: string | null;
    low: number | null;
    lowDate: string | null;
    fromHighPct: number | null;
    fromLowPct: number | null;
    highClose: number | null;
    highCloseDate: string | null;
    fromHighClosePct: number | null;
    lowClose: number | null;
    lowCloseDate: string | null;
    fromLowClosePct: number | null;
}

/** One extreme as the tool prints it: the value, its bar's date, and the last close's distance in percent. */
function extremeView(
    extreme: BarExtreme | null,
    formatDate: (unixSeconds: number) => string
): { value: number | null; date: string | null; fromPct: number | null } {
    return {
        value: extreme?.value ?? null,
        date: extreme === null ? null : formatDate(extreme.time),
        fromPct: ratioToPct(extreme?.fromLastCloseRatio ?? null),
    };
}

/**
 * High/low over `window`, the bar each was set on, and the last close's
 * distance from each. The extremes are core's `computeBarRangeStats` (only
 * finite values count, a later bar wins a tie, so the date is the most recent
 * touch); this formats the bar times with `formatDate` and turns core's raw
 * ratios into rounded percents. Shared by `range` (the 252-bar-on-1Day /
 * all-loaded-intraday window) and `ranges` (fixed 20/60-bar windows) so the
 * projection lives once.
 */
export function computeRangeWindow(
    window: readonly Bar[],
    lastClose: number | null,
    formatDate: (unixSeconds: number) => string
): RangeWindow {
    const stats = computeBarRangeStats(window, lastClose);
    const high = extremeView(stats.high, formatDate);
    const low = extremeView(stats.low, formatDate);
    const highClose = extremeView(stats.highClose, formatDate);
    const lowClose = extremeView(stats.lowClose, formatDate);
    return {
        high: high.value,
        highDate: high.date,
        low: low.value,
        lowDate: low.date,
        fromHighPct: high.fromPct,
        fromLowPct: low.fromPct,
        highClose: highClose.value,
        highCloseDate: highClose.date,
        fromHighClosePct: highClose.fromPct,
        lowClose: lowClose.value,
        lowCloseDate: lowClose.date,
        fromLowClosePct: lowClose.fromPct,
    };
}
