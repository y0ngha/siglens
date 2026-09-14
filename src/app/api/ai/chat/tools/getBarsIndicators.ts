import 'server-only';
import {
    classifyTrend,
    detectCandlePatternEntries,
    detectSignals,
    getDetectionBars,
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
} from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '@/entities/bars/lib/barsDataCache';
import { roundIndicators } from '@/entities/bars/lib/roundIndicators';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import type { ToolExecutor } from './index';
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

/** Max RAW bar-detected candle pattern entries surfaced (`latestCandlePatterns`) — distinct from `MAX_ANALYSIS_CANDLE_PATTERNS` in `projectTechnicalAnalysis.ts`, which caps the AI analysis's own `candlePatterns` field. */
const MAX_BAR_CANDLE_PATTERNS = 5;

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

/** Same `t` formatting as `BarPoint.t` (`YYYY-MM-DDTHH:mm`) so a candle pattern's date lines up with the `bars` series. */
const isoMinute = (unixSeconds: number): string =>
    new Date(unixSeconds * 1000).toISOString().slice(0, 16);

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
 * (`getDetectionBars`) and maps each entry's window-relative `barIndex`
 * back to the bar's date — `detectCandlePatternEntries`' `barIndex` is
 * relative to that window, NOT the full `bars` series.
 */
function latestCandlePatterns(bars: Bar[]): BarCandlePattern[] {
    const detectionBars = getDetectionBars(bars);
    const entries = detectCandlePatternEntries(bars);
    return entries.slice(-MAX_BAR_CANDLE_PATTERNS).map(entry => ({
        date: isoMinute(detectionBars[entry.barIndex]!.time),
        pattern: entry.singlePattern ?? entry.multiPattern,
    }));
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
    const { bars, indicators } = await getCachedBarsWithIndicators(
        getCachedMarketDataProvider(session),
        symbol,
        timeframe,
        asset?.fmpSymbol,
        session
    );
    if (bars.length === 0) return { symbol, timeframe, found: false };
    const requestedBars: BarPoint[] = bars.slice(-count).map(b => ({
        t: isoMinute(b.time),
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
    // Client-serialization-boundary rounding only, same as
    // `getBarsAction.ts` — the cache still holds full-precision values.
    const latest = latestIndicators(roundIndicators(indicators));
    const candlePatterns = latestCandlePatterns(bars);
    const asOf = new Date(bars[bars.length - 1]!.time * 1000).toISOString();

    return fitBarsToBudget(
        (barsForOutput, barsTrimmed) => ({
            asOf,
            source: 'SIGLENS bars + indicators',
            symbol,
            timeframe,
            currency,
            trend,
            signals,
            latest,
            candlePatterns,
            barsReturned: barsForOutput.length,
            barsTrimmed,
            bars: barsForOutput,
        }),
        requestedBars
    );
};
