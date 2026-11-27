import type { Bar } from '@y0ngha/siglens-core';
import { pctVs } from '@/entities/bars/lib/percent';

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

/**
 * The bar holding the extreme of `value` over `window`. Only finite values
 * count; `beats` uses `>=`/`<=` so a LATER bar wins a tie (the date is the most
 * recent touch). One helper serves intraday high/low and the close extremes.
 */
function extremeBar(
    window: readonly Bar[],
    value: (bar: Bar) => number,
    beats: (candidate: number, best: number) => boolean
): Bar | null {
    return window.reduce<Bar | null>((best, b) => {
        const v = value(b);
        if (!Number.isFinite(v)) return best;
        return best === null || beats(v, value(best)) ? b : best;
    }, null);
}

/**
 * High/low over `window`, the bar each was set on, and the last close's
 * distance from each. Only finite highs/lows count — a single bad bar
 * (NaN/Infinity from an upstream data glitch) must not poison the whole
 * window's max/min. `>=`/`<=` let a later bar win a tie, so the date is the
 * most recent touch. Shared by `range` (the 252-bar-on-1Day /
 * all-loaded-intraday window) and `ranges` (fixed 20/60-bar windows) so this
 * filtering logic lives once.
 */
export function computeRangeWindow(
    window: readonly Bar[],
    lastClose: number | null,
    formatDate: (unixSeconds: number) => string
): RangeWindow {
    const highBar = extremeBar(
        window,
        b => b.high,
        (a, best) => a >= best
    );
    const lowBar = extremeBar(
        window,
        b => b.low,
        (a, best) => a <= best
    );
    const highCloseBar = extremeBar(
        window,
        b => b.close,
        (a, best) => a >= best
    );
    const lowCloseBar = extremeBar(
        window,
        b => b.close,
        (a, best) => a <= best
    );
    const high = highBar?.high ?? null;
    const low = lowBar?.low ?? null;
    const highClose = highCloseBar?.close ?? null;
    const lowClose = lowCloseBar?.close ?? null;
    return {
        high,
        highDate: highBar ? formatDate(highBar.time) : null,
        low,
        lowDate: lowBar ? formatDate(lowBar.time) : null,
        fromHighPct: pctVs(lastClose, high),
        fromLowPct: pctVs(lastClose, low),
        highClose,
        highCloseDate: highCloseBar ? formatDate(highCloseBar.time) : null,
        fromHighClosePct: pctVs(lastClose, highClose),
        lowClose,
        lowCloseDate: lowCloseBar ? formatDate(lowCloseBar.time) : null,
        fromLowClosePct: pctVs(lastClose, lowClose),
    };
}
