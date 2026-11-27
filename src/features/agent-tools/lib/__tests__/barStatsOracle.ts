/**
 * TEST-ONLY ORACLE: the siglens bar-statistics implementations as they were
 * before the math moved to core (`computeBarRangeStats`, `computeCloseStreak`,
 * `scanLongTermMaCrosses`, `computeBarChangeStats`,
 * `computeEarningsReactions`), copied verbatim from
 * `lib/rangeWindow.ts`, `lib/levelCandidates.ts`, `lib/earningsHistory.ts`
 * and `server/tools/getBarsIndicators.ts` at origin/master b92d6e550. Only the
 * imports, the `export` keywords on the four entry points and the
 * `EARNINGS_REACTIONS_COUNT` constant (exported from the old file) were added.
 *
 * `barStatsParity.test.ts` runs these against the core-backed code over the
 * seeded corpus and compares the projected output byte for byte. Both files
 * are deleted in the last commit of the PR that moved the math, once the gate
 * has passed: they pin the old code, not a contract.
 */
import {
    calculateMA,
    classifyMaStack,
    findMaCrosses,
    type AgentBarsTimeframe,
    type Bar,
    type IndicatorResult,
    type MaStackDirection,
} from '@y0ngha/siglens-core';
import { pctVs, ratioPct } from '@/entities/bars/lib/percent';
import {
    roundIndicators,
    roundNumber,
} from '@/entities/bars/lib/roundIndicators';
import {
    barDate,
    calendarChangeView,
    type CalendarChangeView,
} from '@/features/agent-tools/lib/calendarChange';

// ---- lib/rangeWindow.ts

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

// ---- lib/levelCandidates.ts (chartReferenceLevels)

/**
 * Chart reference prices of a daily series, the inputs of the level ladder
 * (`buildLevelLadder` in core) beside the analysis's own levels. `null` = not
 * computable (too few bars, or no usable average).
 */
export interface ChartReferenceLevels {
    high52w: number | null;
    low52w: number | null;
    high20: number | null;
    low20: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
}

/** Same windows `get_bars_indicators` uses for `derived.range` (252 daily bars) and `derived.ranges['20bars']`. */
const RANGE_52W_BARS = 252;
const RANGE_20_BARS = 20;

const isoDay = (unixSeconds: number): string =>
    new Date(unixSeconds * 1000).toISOString().slice(0, 10);

const lastOrNull = (series: readonly (number | null)[] | undefined) =>
    series !== undefined && series.length > 0
        ? (series[series.length - 1] ?? null)
        : null;

/**
 * 52-week and 20-day high/low and the 20/50/200-day simple averages of a daily series.
 *
 * Must equal what `get_bars_indicators` prints for the SAME series, or the model would see two different "52-week
 * highs" in one turn: the windows are `bars.slice(-252)` / `bars.slice(-20)` through the shared
 * `computeRangeWindow` (intraday high/low, like `derived.range`), and the averages are read from
 * `roundIndicators(indicators).ma` exactly like `latestIndicators`. The 20-day window needs 20 bars (as `ranges`).
 */
export function chartReferenceLevels(
    dailyBars: readonly Bar[],
    indicators: IndicatorResult
): ChartReferenceLevels {
    const range52 = computeRangeWindow(
        dailyBars.slice(-RANGE_52W_BARS),
        null,
        isoDay
    );
    const range20 =
        dailyBars.length >= RANGE_20_BARS
            ? computeRangeWindow(dailyBars.slice(-RANGE_20_BARS), null, isoDay)
            : null;
    const { ma } = roundIndicators(indicators);
    return {
        high52w: range52.high,
        low52w: range52.low,
        high20: range20?.high ?? null,
        low20: range20?.low ?? null,
        sma20: lastOrNull(ma[20]),
        sma50: lastOrNull(ma[50]),
        sma200: lastOrNull(ma[200]),
    };
}

// ---- lib/earningsHistory.ts (earningsReactions)

/** How many of the newest reported earnings dates get a price reaction. */
const EARNINGS_REACTIONS_COUNT = 8;

/** One past earnings report and how the stock moved across it (dev-2026-10-22 A12). */
export interface EarningsReactionView {
    /** The report date (`YYYY-MM-DD`). */
    date: string;
    /**
     * % change from the close of the last session BEFORE `date` to the close
     * of the first session AFTER it. The window spans the report day and the
     * next session because the data has no before-open/after-close timing: a
     * pre-market report moves the stock on `date`, an after-close one on the
     * next session, and this window covers both.
     */
    movePct: number | null;
}

/**
 * Price reaction to each of the newest {@link EARNINGS_REACTIONS_COUNT}
 * reported earnings dates, newest first, from daily `bars` (oldest-first).
 * A date is skipped when the loaded bars do not have a COMPLETED session on
 * both sides of it (too old for the series, or no finished session after it
 * yet).
 *
 * `lastBarForming`: the cached daily series ends with today's live bar during
 * the session (a 60-second quote snapshot). Its close is the current price,
 * so an after-close report on D read during D+1 would otherwise get a
 * half-day "reaction"; that bar is left out instead.
 */
export function earningsReactions(
    allBars: readonly Bar[],
    reportedDates: readonly string[],
    lastBarForming: boolean
): EarningsReactionView[] {
    const bars = lastBarForming ? allBars.slice(0, -1) : allBars;
    const dates = bars.map(barDate);
    const newestFirst = [...new Set(reportedDates)].toSorted((a, b) =>
        b.localeCompare(a)
    );
    return newestFirst
        .flatMap((date): EarningsReactionView[] => {
            const afterIndex = dates.findIndex(d => d > date);
            // -1: no session after the report yet; 0: the series starts after it.
            if (afterIndex <= 0) return [];
            const beforeIndex =
                dates[afterIndex - 1] === date
                    ? afterIndex - 2
                    : afterIndex - 1;
            const after = bars[afterIndex];
            const before = bars[beforeIndex];
            if (after === undefined || before === undefined) return [];
            return [{ date, movePct: pctVs(after.close, before.close) }];
        })
        .slice(0, EARNINGS_REACTIONS_COUNT);
}

// ---- server/tools/getBarsIndicators.ts (computeDerived and its helpers)

const last = <T>(arr: readonly T[] | undefined): T | null =>
    arr?.at(-1) ?? null;

/**
 * Bar/candle-pattern/`asOf` timestamps used to be an unmarked-UTC minute
 * string (`YYYY-MM-DDTHH:mm`, no `Z`) even for `1Day` bars, which the model
 * could misread as a local time (spec B2). `1Day` now emits a bare
 * `YYYY-MM-DD` (a day has no time-of-day to misread); intraday emits a full
 * ISO instant WITH `Z` so it is unambiguous.
 */
const isoTimestamp = (
    unixSeconds: number,
    timeframe: AgentBarsTimeframe
): string => {
    const iso = new Date(unixSeconds * 1000).toISOString();
    return isDailyOrLonger(timeframe) ? iso.slice(0, 10) : iso;
};

/**
 * Weekly and monthly bars are not a provider timeframe: the tool builds them
 * from daily bars (core `aggregateBarsToWeekly` / `aggregateBarsToMonthly`,
 * the same aggregation `higherTimeframe` already uses for 1Day).
 */
type AggregatedTimeframe = Extract<AgentBarsTimeframe, '1Week' | '1Month'>;

function isAggregatedTimeframe(
    timeframe: AgentBarsTimeframe
): timeframe is AggregatedTimeframe {
    return timeframe === '1Week' || timeframe === '1Month';
}

/** Daily bars and anything built from them carry a date, not a time of day. */
function isDailyOrLonger(timeframe: AgentBarsTimeframe): boolean {
    return timeframe === '1Day' || isAggregatedTimeframe(timeframe);
}

/**
 * Consecutive-close streak ending at the last COMPLETED daily bar, so "며칠
 * 연속 하락" questions need no hand counting. `days` counts consecutive closes
 * moving in `direction` (closes 10,9,8 → down, 2; a single down day after an up
 * day → down, 1). `flat` = the last close equals the previous one; `days` is
 * then the run of unchanged closes. `sinceDate` is the date of the first bar of
 * the streak (the first down day for a down streak).
 *
 * `truncated` is true when the streak runs back to the FIRST loaded bar
 * without a direction change: the real streak may be longer than `days` (and
 * `sinceDate` is only the earliest loaded date), so it must be reported as
 * "at least N days".
 */
interface CloseStreakView {
    direction: 'up' | 'down' | 'flat';
    days: number;
    sinceDate: string;
    truncated: boolean;
}

interface DerivedView {
    lastClose: number | null;
    changePct: {
        '1bar': number | null;
        '5bars': number | null;
        '20bars': number | null;
        '60bars': number | null;
        '252bars': number | null;
    };
    /**
     * Calendar-period returns (1 month / 3 months / 1 year back from the last
     * session's date, base = last session on or before that date), 1Day only —
     * `null` on other timeframes. See `CalendarChangeView` for why these are
     * separate from the bar-count `changePct` keys.
     */
    calendarChange: CalendarChangeView | null;
    range: RangeWindow & { bars: number };
    /**
     * Fixed 20/60-bar high/low windows for ANY timeframe — added after a
     * real-data eval asked "how far below its 60-day high" and got the
     * 52-week `range` high back instead, since `range` is either capped at
     * 252 daily bars or (intraday) every loaded bar, neither of which is a
     * "60-bar high". `null` when fewer than 20 / 60 bars are loaded.
     */
    ranges: {
        '20bars': RangeWindow | null;
        '60bars': RangeWindow | null;
    };
    volumeVsAvg20: number | null;
    atrPct: number | null;
    priceVsMa: Record<string, number | null>;
    maStack: MaStackDirection | null;
    /**
     * 50/200-bar SMA crossings over the last year of daily bars
     * (dev-2026-10-22 A5), oldest first — `[]` when the whole window was
     * checked and none happened. `null` on other timeframes AND when the
     * loaded history is too short to check the whole window (core's
     * `complete: false`): an empty list there would read as "no cross in a
     * year" when the data simply does not reach back that far — the model
     * asserted exactly that for IDXX before this field existed.
     */
    maCross50_200: MaCrossView[] | null;
    /** See {@link CloseStreakView}. `null` off 1Day, with <2 completed bars, or on a non-finite close. */
    closeStreak: CloseStreakView | null;
}

/** One crossing in `derived.maCross50_200`. `kind`: `golden` = MA50 crosses above MA200, `dead` = below. */
interface MaCrossView {
    date: string;
    kind: 'golden' | 'dead';
}

/**
 * SMA periods and window behind `maCross50_200` — the key name is the
 * contract (pinned by a test: a period change forces a key rename).
 */
export const MA_CROSS_FAST_PERIOD = 50;
export const MA_CROSS_SLOW_PERIOD = 200;
/**
 * A tool-window choice (~1 trading year), unrelated to core's 3-bar
 * `CROSS_LOOKBACK_BARS`, which only bounds "fresh cross" signal detection.
 * The agent asks "when did the last golden/dead cross happen", so the scan
 * must reach back a full year.
 */
const MA_CROSS_LOOKBACK_BARS = 252;

/**
 * Detection is core's (`findMaCrosses`); this only adapts it to the tool
 * shape. Runs on the full cached series, never the trimmed output `bars`.
 */
function maCross50_200View(bars: readonly Bar[]): MaCrossView[] | null {
    const scan = findMaCrosses(
        bars.slice(),
        MA_CROSS_FAST_PERIOD,
        MA_CROSS_SLOW_PERIOD,
        MA_CROSS_LOOKBACK_BARS
    );
    if (!scan.complete) return null;
    return scan.crosses.map(c => ({
        date: isoTimestamp(c.time, '1Day'),
        kind: c.kind,
    }));
}

/**
 * Bars back for each `changePct` key — a fixed bar count, not a calendar
 * day count, for every timeframe (spec §3.1). Named `NbarS` (not `Nd`) —
 * a 1Hour "1d" key previously read as a calendar day when it was actually
 * a 1-BAR change; renamed to avoid that misreading (core's tool description
 * mirrors this contract). `252bars` (dev-2026-10-22 A4) is the 1-year bar
 * count on 1Day; it is `null` unless more than 252 bars are loaded. Calendar
 * periods ("1개월", "작년 이맘때") read `calendarChange`, never these keys.
 */
const CHANGE_PCT_BARS_BACK: Record<keyof DerivedView['changePct'], number> = {
    '1bar': 1,
    '5bars': 5,
    '20bars': 20,
    '60bars': 60,
    '252bars': 252,
};

/** Max daily bars `range` looks back over; intraday uses every loaded bar instead (spec §3.1). */
const RANGE_MAX_DAILY_BARS = 252;

/** Bars back for each `ranges` window — a fixed bar count for every timeframe, same convention as `CHANGE_PCT_BARS_BACK`. */
const RANGES_BARS_BACK: Record<keyof DerivedView['ranges'], number> = {
    '20bars': 20,
    '60bars': 60,
};

/**
 * Period behind `priceVsMa.ma50Pct`. The key name is the contract (core's
 * `get_bars_indicators` description documents `ma50Pct`), so this is its own
 * constant rather than `CONFLUENCE_TREND_MA_PERIOD` — that one is a confluence
 * tuning knob, and retuning it must not silently turn `ma50Pct` into some
 * other period. (`higherTimeframeView`'s `priceVsMa50Pct` deliberately DOES
 * use the confluence constant, to match the gate it explains.)
 */
export const MA50_PERIOD = 50;

function directionOf(sign: number): CloseStreakView['direction'] {
    if (sign > 0) return 'up';
    return sign < 0 ? 'down' : 'flat';
}

/**
 * Streak of same-direction closes ending at the last completed daily bar.
 * `lastBarInProgress` drops the forming bar (its "close" is the live price).
 * Scans only the loaded bars; any non-finite close inside the walked run makes
 * the result `null` rather than a silently shortened streak.
 */
function computeCloseStreak(
    bars: readonly Bar[],
    timeframe: AgentBarsTimeframe,
    lastBarInProgress: boolean
): CloseStreakView | null {
    if (timeframe !== '1Day') return null;
    const completed = lastBarInProgress ? bars.slice(0, -1) : bars;
    if (completed.length < 2) return null;
    // moves[j] = direction of the close move INTO bar j + 1 (NaN when either close is non-finite).
    const moves = completed.slice(1).map((b, j) => {
        // j < completed.length - 1 이라 completed[j]는 항상 있다.
        const diff = b.close - completed[j].close;
        return Number.isFinite(diff) ? Math.sign(diff) : Number.NaN;
    });
    const lastMove = moves.at(-1);
    if (lastMove === undefined || Number.isNaN(lastMove)) return null;
    // Last move that differs from the final one; -1 = the streak spans every loaded bar.
    const breakIdx = moves.findLastIndex(m => m !== lastMove);
    if (breakIdx >= 0 && Number.isNaN(moves[breakIdx])) return null;
    const sinceBar = completed[breakIdx + 2];
    if (sinceBar === undefined) return null;
    return {
        direction: directionOf(lastMove),
        days: moves.length - 1 - breakIdx,
        sinceDate: isoTimestamp(sinceBar.time, timeframe),
        truncated: breakIdx === -1,
    };
}

/**
 * Values the LLM used to compute itself from raw `bars`/`latest` — returns,
 * 52-week position (plus fixed 20/60-bar high/low windows — `ranges` — for
 * "N-day high/low" questions `range` alone can't answer), volume ratio,
 * MA/EMA distance (plus a fixed 50-bar MA distance — `ma50Pct` — even when
 * 50 isn't one of the caller-configured MA periods), ATR% (spec §3.1, audit
 * B1). Every field follows the null rule (spec §0): computed only when every
 * input is finite and (for a percentage) the base is positive.
 */
export function computeDerived(
    bars: readonly Bar[],
    indicators: IndicatorResult,
    timeframe: AgentBarsTimeframe,
    lastBarInProgress: boolean
): DerivedView {
    const lastClose = last(bars.map(b => b.close));
    const changePct = Object.fromEntries(
        Object.entries(CHANGE_PCT_BARS_BACK).map(([key, barsBack]) => {
            const base =
                bars.length > barsBack
                    ? (bars[bars.length - 1 - barsBack]?.close ?? null)
                    : null;
            return [key, pctVs(lastClose, base)];
        })
    ) as DerivedView['changePct'];

    const formatDate = (unixSeconds: number): string =>
        isoTimestamp(unixSeconds, timeframe);
    const rangeWindow =
        timeframe === '1Day' ? bars.slice(-RANGE_MAX_DAILY_BARS) : bars;
    const range = {
        ...computeRangeWindow(rangeWindow, lastClose, formatDate),
        bars: rangeWindow.length,
    };

    const ranges = Object.fromEntries(
        Object.entries(RANGES_BARS_BACK).map(([key, n]) => [
            key,
            bars.length >= n
                ? computeRangeWindow(bars.slice(-n), lastClose, formatDate)
                : null,
        ])
    ) as DerivedView['ranges'];

    const prevVolumes = bars.slice(-21, -1).map(b => b.volume);
    const lastVolume = last(bars.map(b => b.volume));
    const avgVolume20 =
        prevVolumes.length === 20 && prevVolumes.every(Number.isFinite)
            ? prevVolumes.reduce((sum, v) => sum + v, 0) / prevVolumes.length
            : null;
    // A partial week or month holds only part of a period's volume, so its
    // ratio to 20 full periods would read as a collapse for days.
    const partialPeriod = isAggregatedTimeframe(timeframe) && lastBarInProgress;
    const volumeVsAvg20 =
        !partialPeriod &&
        lastVolume !== null &&
        Number.isFinite(lastVolume) &&
        avgVolume20 !== null &&
        avgVolume20 > 0
            ? roundNumber(lastVolume / avgVolume20)
            : null;

    // ATR is a ratio OF price (atr / price), not a percent DIFFERENCE from a
    // base like the other `...Pct` fields — `pctVs` would compute
    // `(atr - price) / price` instead.
    const atrPct = ratioPct(last(indicators.atr), lastClose);

    // `calculateMA` needs a mutable array; `bars` stays `readonly` at the
    // param boundary so `.slice()` here is a defensive copy, not a weakened
    // contract.
    const ma50 = last(calculateMA(bars.slice(), MA50_PERIOD));
    const priceVsMa: Record<string, number | null> = {
        // Computed directly (not read from `indicators.ma`, which only
        // carries the caller-configured MA periods and may not include 50)
        // so a 50-bar MA distance is ALWAYS available — spread first so a
        // real `indicators.ma['50']`, if 50 IS one of the configured
        // periods, overwrites this fallback rather than the other way
        // around.
        ma50Pct: pctVs(lastClose, ma50),
        ...Object.fromEntries(
            Object.entries(indicators.ma).map(([period, series]) => [
                `ma${period}Pct`,
                pctVs(lastClose, last(series)),
            ])
        ),
        ...Object.fromEntries(
            Object.entries(indicators.ema).map(([period, series]) => [
                `ema${period}Pct`,
                pctVs(lastClose, last(series)),
            ])
        ),
    };

    const maStack = classifyMaStack(indicators);

    return {
        lastClose,
        changePct,
        calendarChange: timeframe === '1Day' ? calendarChangeView(bars) : null,
        range,
        ranges,
        volumeVsAvg20,
        atrPct,
        priceVsMa,
        maStack,
        maCross50_200: timeframe === '1Day' ? maCross50_200View(bars) : null,
        closeStreak: computeCloseStreak(bars, timeframe, lastBarInProgress),
    };
}
