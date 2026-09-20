import 'server-only';
import {
    aggregateBarsToWeekly,
    calculateIndicators,
    computeFearGreedIndex,
    calculateMA,
    classifyTrend,
    CONFLUENCE_TREND_MA_PERIOD,
    detectCandlePatternEntries,
    detectSignals,
    evaluateConfluence,
    getDetectionBars,
    MA_DEFAULT_PERIODS,
    scoreConfluence,
    selectLastCandlePatternEntries,
    type Bar,
    type BollingerResult,
    type CandlePattern,
    type DMIResult,
    type IchimokuResult,
    type IndicatorResult,
    type MACDResult,
    type MultiCandlePattern,
    type SqueezeMomentumResult,
    type StochasticResult,
    type Timeframe,
    type TrendDirection,
    type TrendState,
} from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '@/entities/bars/lib/barsDataCache';
import {
    roundIndicators,
    roundNumber,
} from '@/entities/bars/lib/roundIndicators';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import type { ToolExecutor } from './index';
import { logToolDegrade } from './logToolDegrade';
import { pctVs, ratioPct } from './percent';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';
import { BARS_RESULT_MAX_CHARS } from './truncate';

/**
 * Restored 20 → 30 (2026-09-14): this tool now fits against its own
 * `BARS_RESULT_MAX_CHARS` (6,000, not the shared `TOOL_RESULT_MAX_CHARS`
 * 4,000) — `fitBarsToBudget`'s trim loop already guarantees that ceiling
 * for any `bars` the model requests, so the default no longer needs to
 * shrink just to keep the common (unbudgeted) case comfortably under 4,000.
 */
const DEFAULT_BARS = 30;
/**
 * The model controls `bars`. `0` would hit the `slice(-0)` trap (JS returns the
 * WHOLE array, not none), and a negative value slices from the wrong end.
 */
const MAX_BARS = 200;

function clampBars(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_BARS;
    return Math.min(Math.max(Math.trunc(raw), 1), MAX_BARS);
}

interface BarPoint {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

/**
 * The registry-level `truncateToolResult` (`./truncate.ts`) cuts the
 * SERIALIZED STRING from the front once it exceeds the budget. `bars` is
 * ordered oldest-first and serialized last in the object, so that cut lands
 * on the newest bars first — exactly the ones the model needs most (e.g.
 * `bars: 60` on a symbol with wide MA/EMA/signal payloads). Trim the OLDEST
 * bars here instead, before the object ever reaches that generic truncator,
 * so the newest bar always survives.
 */
function fitBarsToBudget<T extends { bars: BarPoint[] }>(
    buildResult: (bars: BarPoint[], barsTrimmed: number) => T,
    allBars: BarPoint[]
): T {
    let bars = allBars;
    let barsTrimmed = 0;
    // Estimate how many bars the overflow is worth and drop them in one step
    // instead of re-serializing per bar (a few thousand bars would otherwise
    // mean thousands of full serializations). Re-measure and repeat, since the
    // per-bar cost is only an average.
    const MAX_ITERATIONS = 30;
    for (let i = 0; i < MAX_ITERATIONS && bars.length > 1; i++) {
        const serialized = JSON.stringify(buildResult(bars, barsTrimmed));
        const overflow = serialized.length - BARS_RESULT_MAX_CHARS;
        if (overflow <= 0) break;
        const perBar = Math.max(1, Math.ceil(serialized.length / bars.length));
        const drop = Math.min(
            bars.length - 1,
            Math.max(1, Math.ceil(overflow / perBar))
        );
        bars = bars.slice(drop);
        barsTrimmed += drop;
    }
    return buildResult(bars, barsTrimmed);
}

const last = <T>(arr: readonly T[] | undefined): T | null =>
    arr && arr.length > 0 ? arr[arr.length - 1]! : null;

/** Same significant-digit rounding as `roundIndicators`, but null-safe for a value that may be `null`/non-finite. */
const roundOrNull = (v: number | null): number | null =>
    v !== null && Number.isFinite(v) ? roundNumber(v) : null;

/** Picks a compact subset of fields from the latest entry of a per-bar indicator array. Tolerates a missing/empty array. */
function lastPick<T, K extends keyof T>(
    arr: readonly T[] | undefined,
    keys: readonly K[]
): Pick<T, K> | null {
    const item = last(arr);
    if (!item) return null;
    const out = {} as Pick<T, K>;
    for (const k of keys) out[k] = item[k];
    return out;
}

/** Return shape of `latestIndicators` — compact last-value view of every indicator core computes for the series. */
interface LatestIndicatorsView {
    rsi: number | null;
    macd: MACDResult | null;
    bollinger: BollingerResult | null;
    atr: number | null;
    ma: Record<string, number | null>;
    ema: Record<string, number | null>;
    dmi: Pick<DMIResult, 'adx' | 'diPlus' | 'diMinus'> | null;
    stochastic: Pick<StochasticResult, 'percentK' | 'percentD'> | null;
    cci: number | null;
    mfi: number | null;
    williamsR: number | null;
    vwap: number | null;
    ichimoku: Pick<
        IchimokuResult,
        'tenkan' | 'kijun' | 'senkouA' | 'senkouB'
    > | null;
    supertrend: { value: number | null; trend: TrendDirection } | null;
    parabolicSar: { sar: number | null; trend: TrendDirection } | null;
    squeezeMomentum: Pick<SqueezeMomentumResult, 'momentum' | 'sqzOn'> | null;
}

/**
 * Compact last-value view of every indicator core computes for the series —
 * previously only RSI/MACD/Bollinger/ATR/MA/EMA reached the model, leaving
 * ~30 other indicators (DMI, stochastic, CCI, MFI, Williams %R, VWAP,
 * Ichimoku, Supertrend, Parabolic SAR, Squeeze Momentum, ...) invisible.
 */
function latestIndicators(ind: IndicatorResult): LatestIndicatorsView {
    const supertrend = last(ind.supertrend);
    const parabolicSar = last(ind.parabolicSar);
    return {
        rsi: last(ind.rsi),
        macd: last(ind.macd),
        bollinger: last(ind.bollinger),
        atr: last(ind.atr),
        ma: Object.fromEntries(
            Object.entries(ind.ma).map(([p, s]) => [p, last(s)])
        ),
        ema: Object.fromEntries(
            Object.entries(ind.ema).map(([p, s]) => [p, last(s)])
        ),
        dmi: lastPick(ind.dmi, ['adx', 'diPlus', 'diMinus']),
        stochastic: lastPick(ind.stochastic, ['percentK', 'percentD']),
        cci: last(ind.cci),
        mfi: last(ind.mfi),
        williamsR: last(ind.williamsR),
        vwap: last(ind.vwap),
        ichimoku: lastPick(ind.ichimoku, [
            'tenkan',
            'kijun',
            'senkouA',
            'senkouB',
        ]),
        supertrend: supertrend
            ? { value: supertrend.supertrend, trend: supertrend.trend }
            : null,
        parabolicSar: parabolicSar
            ? { sar: parabolicSar.sar, trend: parabolicSar.trend }
            : null,
        squeezeMomentum: lastPick(ind.squeezeMomentum, ['momentum', 'sqzOn']),
    };
}

/**
 * Bar/candle-pattern/`asOf` timestamps used to be an unmarked-UTC minute
 * string (`YYYY-MM-DDTHH:mm`, no `Z`) even for `1Day` bars, which the model
 * could misread as a local time (spec B2). `1Day` now emits a bare
 * `YYYY-MM-DD` (a day has no time-of-day to misread); intraday emits a full
 * ISO instant WITH `Z` so it is unambiguous.
 */
const isoTimestamp = (unixSeconds: number, timeframe: Timeframe): string => {
    const iso = new Date(unixSeconds * 1000).toISOString();
    return timeframe === '1Day' ? iso.slice(0, 10) : iso;
};

/**
 * Return element of `latestCandlePatterns` — named distinctly from core's
 * `CandlePatternEntry` (which this is derived from but reshapes: a resolved
 * date instead of a window-relative `barIndex`, and a single `pattern`
 * instead of separate `singlePattern`/`multiPattern` fields).
 */
interface BarCandlePattern {
    date: string;
    pattern: CandlePattern | MultiCandlePattern | null;
}

/**
 * Detects candle patterns over the trailing window core scans
 * (`getDetectionBars`), then keeps only the freshest multi-bar + freshest
 * single-bar entry via `selectLastCandlePatternEntries` — the SAME selection
 * the chart markers (`useCandlePatternMarkers.ts`) and the analysis prompt
 * use, so the model sees the same candle semantics as the chart rather than
 * an arbitrary tail slice of the raw detection list. Maps each entry's
 * window-relative `barIndex` back to the bar's date —
 * `detectCandlePatternEntries`' `barIndex` is relative to that window, NOT
 * the full `bars` series.
 */
function latestCandlePatterns(
    bars: Bar[],
    timeframe: Timeframe
): BarCandlePattern[] {
    const detectionBars = getDetectionBars(bars);
    const entries = detectCandlePatternEntries(bars);
    return selectLastCandlePatternEntries(entries).map(entry => ({
        date: isoTimestamp(detectionBars[entry.barIndex]!.time, timeframe),
        pattern: entry.singlePattern ?? entry.multiPattern,
    }));
}

/** Compact view of core's `ConfluenceSnapshot` — drops `timeframe`/`barTime`/`close` (already in the output) and `params`. */
interface BarsConfluenceView {
    score: number;
    entryRuleMet: boolean;
    exitRuleMet: boolean;
    bullish: string[];
    bearish: string[];
    freshBullish: string[];
    freshBearish: string[];
    ma50: number | null;
    htfGate: 'on' | 'off';
}

/**
 * Rule-based indicator-family confluence (no AI) — the same entry/exit rule
 * siglens-trader acts on — computed from the full cached series.
 *
 * `htfBars` (loaded once for `higherTimeframe`, §3.1) is threaded into core's
 * own HTF alignment gate when available, so `entryRuleMet` matches the
 * trader's gated rule instead of always omitting that clause; `htfGate`
 * reports which happened rather than a hardcoded `'off'` (spec B3).
 * `entryRuleMet`/`exitRuleMet` were named `entryTrigger`/`exitTrigger` —
 * renamed so prose never reads them as a buy/sell instruction (spec §3.1).
 *
 * `null` when core abstains (fewer than `CONFLUENCE_MIN_BARS` bars or a
 * non-finite last close) — an abstention, not a neutral 50.
 */
function confluenceView(
    bars: Bar[],
    timeframe: Timeframe,
    htfBars: readonly Bar[] | null,
    htfLabel: string | null
): BarsConfluenceView | null {
    const gateOn = htfBars !== null && htfBars.length > 0;
    const snapshot = evaluateConfluence(bars, {
        timeframe,
        htfBars: gateOn ? htfBars : undefined,
        htfLabel: gateOn ? htfLabel : undefined,
    });
    if (!snapshot) return null;
    return {
        score: scoreConfluence(snapshot),
        entryRuleMet: snapshot.entryTrigger,
        exitRuleMet: snapshot.exitTrigger,
        bullish: snapshot.bullish,
        bearish: snapshot.bearish,
        freshBullish: snapshot.freshBullish,
        freshBearish: snapshot.freshBearish,
        // Same significant-digit rounding `roundIndicators` applies to `latest`.
        ma50: snapshot.ma50 === null ? null : roundNumber(snapshot.ma50),
        // `snapshot.htfTrend` (not `gateOn`, which only reflects whether we
        // OFFERED htf bars): core's own docs say `htfTrend` is `null` "when
        // the gate was off OR bars were absent" — i.e. core can still
        // internally decide not to apply the gate even when `htfBars` was
        // passed in, so `htfGate` must report what core actually DID, not
        // what the caller merely attempted.
        htfGate: snapshot.htfTrend !== null ? 'on' : 'off',
    };
}

/** `Timeframe` → the next larger INTRADAY timeframe `get_bars_indicators` loads for `higherTimeframe` (spec §3.1). `1Day`'s higher timeframe is weekly, aggregated from the already-loaded daily bars instead (see `loadHigherTimeframe` below) — no entry here. */
const HTF_MAP: Partial<Record<Timeframe, Timeframe>> = {
    '4Hour': '1Day',
    '1Hour': '4Hour',
    '30Min': '1Hour',
    '15Min': '1Hour',
    '5Min': '30Min',
};

/** `higherTimeframe.timeframe`'s label set — `Timeframe` plus `'1Week'`, which core's `Timeframe` union doesn't carry (weekly bars are a siglens-side aggregation, not a provider-fetched timeframe). */
type HtfTimeframeLabel = Timeframe | '1Week';

interface HigherTimeframeView {
    timeframe: HtfTimeframeLabel;
    trend: TrendState;
    confluenceScore: number | null;
    priceVsMa50Pct: number | null;
    rsi: number | null;
}

/**
 * Loads the next larger timeframe's bars (spec §3.1). `1Day` aggregates the
 * ALREADY-LOADED daily `mainBars` into ISO weeks via core's
 * `aggregateBarsToWeekly` — no second fetch, since the source bars are the
 * same series the main tool call already has in hand — then runs core's
 * `calculateIndicators` on the weekly series (its own warm-up/min-bars
 * handling applies, same as any other timeframe). Every other timeframe
 * fetches its HTF bars via the same cached loader the main series uses.
 * Returns `null` when there is no mapping, the source is empty, or the
 * fetch/aggregation throws (a missing higher timeframe must degrade
 * `higherTimeframe`/`confluence.htfGate` to off, never fail the whole tool).
 */
async function loadHigherTimeframe(
    provider: ReturnType<typeof getCachedMarketDataProvider>,
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol: string | undefined,
    session: ReturnType<typeof sessionSpecFor>,
    mainBars: readonly Bar[]
): Promise<{
    timeframe: HtfTimeframeLabel;
    bars: Bar[];
    indicators: IndicatorResult;
} | null> {
    if (timeframe === '1Day') {
        try {
            const weeklyBars = aggregateBarsToWeekly(mainBars);
            if (weeklyBars.length === 0) return null;
            return {
                timeframe: '1Week',
                bars: weeklyBars,
                indicators: calculateIndicators(weeklyBars),
            };
        } catch (error) {
            logToolDegrade(
                'get_bars_indicators',
                'weekly higher-timeframe aggregation',
                error
            );
            return null;
        }
    }
    const htfTimeframe = HTF_MAP[timeframe];
    if (!htfTimeframe) return null;
    try {
        const { bars, indicators } = await getCachedBarsWithIndicators(
            provider,
            symbol,
            htfTimeframe,
            fmpSymbol,
            session
        );
        if (bars.length === 0) return null;
        return { timeframe: htfTimeframe, bars, indicators };
    } catch (error) {
        logToolDegrade(
            'get_bars_indicators',
            'higher-timeframe bars fetch',
            error
        );
        return null;
    }
}

/**
 * Compact higher-timeframe read-out (spec §3.1): the next larger timeframe's
 * trend and confluence tally, so the model can say when it disagrees with the
 * requested timeframe. `confluenceScore` is `null` (not core's neutral-50
 * default) when core abstains, per the null rule — a neutral score would
 * read as a real reading here, not an abstention.
 *
 * `priceVsMa50Pct` uses core's own `calculateMA(htf.bars,
 * CONFLUENCE_TREND_MA_PERIOD)` — the SAME MA definition
 * `evaluateConfluence`'s own `ma50` uses internally (replacing a
 * hand-rolled plain-average reimplementation) — INSTEAD OF
 * reading `snapshot?.ma50` directly: `1Day`'s higher timeframe is weekly
 * bars aggregated from the already-loaded daily series, and even the
 * production max of 500 daily bars aggregates to only ~101 weekly bars —
 * well under `CONFLUENCE_MIN_BARS` (120), so `evaluateConfluence` abstains
 * (`snapshot === null`) for every `1Day` request, no matter how much
 * history is loaded. `confluenceScore` staying `null` in that case is
 * honest (core really did abstain), but the same MA is still computable
 * independent of confluence's own bar-count gate, so `priceVsMa50Pct` no
 * longer piggybacks on `snapshot?.ma50`.
 */
function higherTimeframeView(
    htf: {
        timeframe: HtfTimeframeLabel;
        bars: Bar[];
        indicators: IndicatorResult;
    } | null
): HigherTimeframeView | null {
    if (!htf) return null;
    const snapshot = evaluateConfluence(htf.bars, { timeframe: htf.timeframe });
    const lastClose = last(htf.bars.map(b => b.close));
    const ma50 = last(calculateMA(htf.bars, CONFLUENCE_TREND_MA_PERIOD));
    return {
        timeframe: htf.timeframe,
        trend: classifyTrend(htf.bars, htf.indicators),
        confluenceScore: snapshot ? scoreConfluence(snapshot) : null,
        priceVsMa50Pct: pctVs(lastClose, ma50),
        rsi: roundOrNull(last(htf.indicators.rsi)),
    };
}

/** High/low over a window and the last close's distance from each — shared shape for `range` (which also carries `bars`, the window size actually used) and every entry of `ranges`. */
interface RangeWindow {
    high: number | null;
    low: number | null;
    fromHighPct: number | null;
    fromLowPct: number | null;
}

interface DerivedView {
    lastClose: number | null;
    changePct: {
        '1bar': number | null;
        '5bars': number | null;
        '20bars': number | null;
        '60bars': number | null;
    };
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
    maStack: 'bullish' | 'bearish' | 'mixed' | null;
}

/**
 * Bars back for each `changePct` key — a fixed bar count, not a calendar
 * day count, for every timeframe (spec §3.1). Named `NbarS` (not `Nd`) —
 * a 1Hour "1d" key previously read as a calendar day when it was actually
 * a 1-BAR change; renamed to avoid that misreading (core's tool description
 * mirrors this contract).
 */
const CHANGE_PCT_BARS_BACK: Record<keyof DerivedView['changePct'], number> = {
    '1bar': 1,
    '5bars': 5,
    '20bars': 20,
    '60bars': 60,
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

/**
 * High/low over `window` and the last close's distance from each. Only
 * finite highs/lows count — a single bad bar (NaN/Infinity from an upstream
 * data glitch) must not poison the whole window's max/min. Shared by `range`
 * (the 252-bar-on-1Day / all-loaded-intraday window) and `ranges` (fixed
 * 20/60-bar windows) so this filtering logic lives once.
 */
function computeRangeWindow(
    window: readonly Bar[],
    lastClose: number | null
): RangeWindow {
    const finiteHighs = window.map(b => b.high).filter(Number.isFinite);
    const finiteLows = window.map(b => b.low).filter(Number.isFinite);
    const high = finiteHighs.length > 0 ? Math.max(...finiteHighs) : null;
    const low = finiteLows.length > 0 ? Math.min(...finiteLows) : null;
    return {
        high,
        low,
        fromHighPct: pctVs(lastClose, high),
        fromLowPct: pctVs(lastClose, low),
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
function computeDerived(
    bars: readonly Bar[],
    indicators: IndicatorResult,
    timeframe: Timeframe
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

    const rangeWindow =
        timeframe === '1Day' ? bars.slice(-RANGE_MAX_DAILY_BARS) : bars;
    const range = {
        ...computeRangeWindow(rangeWindow, lastClose),
        bars: rangeWindow.length,
    };

    const ranges = Object.fromEntries(
        Object.entries(RANGES_BARS_BACK).map(([key, n]) => [
            key,
            bars.length >= n
                ? computeRangeWindow(bars.slice(-n), lastClose)
                : null,
        ])
    ) as DerivedView['ranges'];

    const prevVolumes = bars.slice(-21, -1).map(b => b.volume);
    const lastVolume = last(bars.map(b => b.volume));
    const avgVolume20 =
        prevVolumes.length === 20 && prevVolumes.every(Number.isFinite)
            ? prevVolumes.reduce((sum, v) => sum + v, 0) / prevVolumes.length
            : null;
    const volumeVsAvg20 =
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

    const maStack = maStackDirection(indicators);

    return {
        lastClose,
        changePct,
        range,
        ranges,
        volumeVsAvg20,
        atrPct,
        priceVsMa,
        maStack,
    };
}

/**
 * `'bullish'` when `MA_DEFAULT_PERIODS`' values strictly decrease as the
 * period grows (`MA5 > MA20 > MA60 > ...`), `'bearish'` for strictly
 * increasing, `'mixed'` otherwise. `null` when fewer than 2 configured
 * periods have a value — a single point can't describe a stack (spec §3.1).
 */
function maStackDirection(
    indicators: IndicatorResult
): 'bullish' | 'bearish' | 'mixed' | null {
    const values = MA_DEFAULT_PERIODS.map(p => last(indicators.ma[p])).filter(
        (v): v is number => v !== null && Number.isFinite(v)
    );
    if (values.length < 2) return null;
    const bullish = values.every((v, i) => i === 0 || v < values[i - 1]!);
    const bearish = values.every((v, i) => i === 0 || v > values[i - 1]!);
    return bullish ? 'bullish' : bearish ? 'bearish' : 'mixed';
}

/** `get_bars_indicators`'s `fearGreed` field — the symbol's own index, not the market-wide one. */
interface SymbolFearGreedView {
    score: number;
    label: string;
    confidence: string;
    groups: { name: string; score: number }[];
}

/**
 * The symbol's own Fear & Greed reading — the same number `/{symbol}/fear-greed`
 * shows, from the same core function over the same inputs the page uses
 * (`useFearGreedFromSymbol`: daily bars + `indicators.buySellVolume`). Nothing
 * extra is fetched; both were already in hand.
 *
 * **Daily only.** The page pins the index to `1Day` bars by spec, so computing
 * it off a 4-hour or 30-minute series would hand the model a score that no
 * screen shows and that cannot be compared with the one that does. Other
 * timeframes get `null`.
 *
 * `null` also when core abstains — the walk-forward sample is too short for
 * percentiles (a young listing, or a short loaded history).
 */
function fearGreedView(
    bars: readonly Bar[],
    indicators: IndicatorResult,
    timeframe: Timeframe
): SymbolFearGreedView | null {
    if (timeframe !== '1Day') return null;
    // core는 `buySellVolume`을 봉과 **1:1로 나란한 배열**로 전제하고 인덱스로 읽는다.
    // 짧거나 없는 배열이 들어오면 거기서 throw가 나 도구 전체가 죽는다 — 공포·탐욕
    // 한 필드 때문에 시세·지표 답변을 통째로 잃을 이유는 없다.
    const flow = indicators.buySellVolume;
    if (!Array.isArray(flow) || flow.length < bars.length) return null;
    const snapshot = computeFearGreedIndex([...bars], flow);
    if (!snapshot) return null;
    return {
        score: snapshot.score,
        label: snapshot.label,
        confidence: snapshot.confidence,
        groups: snapshot.groups.map(g => ({ name: g.name, score: g.score })),
    };
}

export const getBarsIndicatorsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    const timeframe = args.timeframe as Timeframe;
    const count = clampBars(args.bars);
    const [profile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        // `Promise.all` rejects as soon as ANY promise rejects, so an
        // unwrapped `getAssetInfo` would sink the sibling
        // `resolveMarketProfile` call too and fail bars+indicators outright
        // over a lookup whose only output here is `fmpSymbol`.
        resolveAssetInfoOrNull(symbol, 'get_bars_indicators'),
    ]);
    const session = sessionSpecFor(profile);
    const provider = getCachedMarketDataProvider(session);
    const { bars, indicators } = await getCachedBarsWithIndicators(
        provider,
        symbol,
        timeframe,
        asset?.fmpSymbol,
        session
    );
    if (bars.length === 0) return { symbol, timeframe, found: false };
    const requestedBars: BarPoint[] = bars.slice(-count).map(b => ({
        t: isoTimestamp(b.time, timeframe),
        o: b.open,
        h: b.high,
        l: b.low,
        c: b.close,
        v: b.volume,
    }));
    const currency = getDescriptor(profile).priceFormat.currency;
    const trend = classifyTrend(bars, indicators);
    const signals = detectSignals(bars, indicators).map(s => ({
        type: s.type,
        direction: s.direction,
        phase: s.phase,
    }));
    const htf = await loadHigherTimeframe(
        provider,
        symbol,
        timeframe,
        asset?.fmpSymbol,
        session,
        bars
    );
    const confluence = confluenceView(
        bars,
        timeframe,
        htf?.bars ?? null,
        htf?.timeframe ?? null
    );
    const higherTimeframe = higherTimeframeView(htf);
    const derived = computeDerived(bars, indicators, timeframe);
    // Client-serialization-boundary rounding only, same as
    // `getBarsAction.ts` — the cache still holds full-precision values.
    const latest = latestIndicators(roundIndicators(indicators));
    const candlePatterns = latestCandlePatterns(bars, timeframe);
    const fearGreed = fearGreedView(bars, indicators, timeframe);
    const asOf = isoTimestamp(bars[bars.length - 1]!.time, timeframe);

    return fitBarsToBudget(
        (barsForOutput, barsTrimmed) => ({
            asOf,
            source: 'SIGLENS bars + indicators',
            symbol,
            timeframe,
            currency,
            trend,
            signals,
            confluence,
            higherTimeframe,
            derived,
            latest,
            candlePatterns,
            fearGreed,
            barsReturned: barsForOutput.length,
            barsTrimmed,
            bars: barsForOutput,
        }),
        requestedBars
    );
};
