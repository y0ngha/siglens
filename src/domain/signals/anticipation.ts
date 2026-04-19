import type { Bar, BollingerResult, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    DIVERGENCE_FRESHNESS_BARS,
    DIVERGENCE_LOOKBACK_BARS,
    HISTOGRAM_CONVERGENCE_BARS,
    PIVOT_WINDOW,
    SQUEEZE_LOOKBACK_BARS,
    SQUEEZE_PCT_B_THRESHOLD,
    SQUEEZE_PERCENTILE,
    SR_APPROACH_LOOKBACK,
    SR_MA_PERIODS,
    SR_PROXIMITY_PCT,
    TREND_SLOPE_LOOKBACK,
} from '@/domain/signals/constants';
import { calculateMA } from '@/domain/indicators/ma';

export function findPivotLows(lows: number[], window: number): number[] {
    const pivots: number[] = [];
    for (let i = window; i < lows.length - window; i++) {
        const cur = lows[i];
        let isPivot = true;
        for (let k = 1; k <= window; k++) {
            if (!(cur < lows[i - k]) || !(cur < lows[i + k])) {
                isPivot = false;
                break;
            }
        }
        if (isPivot) pivots.push(i);
    }
    return pivots;
}

export function findPivotHighs(highs: number[], window: number): number[] {
    const pivots: number[] = [];
    for (let i = window; i < highs.length - window; i++) {
        const cur = highs[i];
        let isPivot = true;
        for (let k = 1; k <= window; k++) {
            if (!(cur > highs[i - k]) || !(cur > highs[i + k])) {
                isPivot = false;
                break;
            }
        }
        if (isPivot) pivots.push(i);
    }
    return pivots;
}

export function computeBbWidth(bb: BollingerResult): number | null {
    if (bb.upper === null || bb.middle === null || bb.lower === null)
        return null;
    if (bb.middle === 0) return null;
    return (bb.upper - bb.lower) / bb.middle;
}

export function computePctB(close: number, bb: BollingerResult): number | null {
    if (bb.upper === null || bb.lower === null) return null;
    const denom = bb.upper - bb.lower;
    if (denom === 0) return null;
    return (close - bb.lower) / denom;
}

export function computeEma20Slope(
    ema: (number | null)[],
    lookback: number
): number | null {
    if (ema.length < lookback + 1) return null;
    const last = ema[ema.length - 1];
    const prev = ema[ema.length - 1 - lookback];
    if (last === null || prev === null || prev === 0) return null;
    return (last - prev) / prev;
}

export function percentileRank(value: number, xs: number[]): number | null {
    if (xs.length === 0) return null;
    if (xs.length === 1) {
        if (value === xs[0]) return 0.5;
        return value > xs[0] ? 1 : 0;
    }
    const below = xs.filter(x => x < value).length;
    const equal = xs.filter(x => x === value).length;
    if (equal === 0) {
        return below / xs.length;
    }
    return below / (xs.length - 1);
}

type DivergenceKind = 'bullish' | 'bearish';

function detectRegularDivergence(
    bars: Bar[],
    rsi: (number | null)[],
    kind: DivergenceKind
): number | null {
    if (bars.length < DIVERGENCE_LOOKBACK_BARS) return null;
    const windowStart = bars.length - DIVERGENCE_LOOKBACK_BARS;
    const lastIdx = bars.length - 1;

    const series =
        kind === 'bullish'
            ? bars.slice(windowStart).map(b => b.low)
            : bars.slice(windowStart).map(b => b.high);
    const pivotsLocal =
        kind === 'bullish'
            ? findPivotLows(series, PIVOT_WINDOW)
            : findPivotHighs(series, PIVOT_WINDOW);

    if (pivotsLocal.length < 2) return null;

    // Convert local-window indices back to absolute indices
    const pivots = pivotsLocal.map(i => i + windowStart);
    const p1 = pivots[pivots.length - 2];
    const p2 = pivots[pivots.length - 1];

    // Freshness: second pivot must be within last N bars
    if (lastIdx - p2 > DIVERGENCE_FRESHNESS_BARS) return null;

    const price1 = kind === 'bullish' ? bars[p1].low : bars[p1].high;
    const price2 = kind === 'bullish' ? bars[p2].low : bars[p2].high;
    const rsi1 = rsi[p1];
    const rsi2 = rsi[p2];
    if (rsi1 == null || rsi2 == null) {
        return null;
    }

    if (kind === 'bullish') {
        // Regular: price lower low, rsi higher low
        if (price2 >= price1) return null;
        if (rsi2 <= rsi1) return null;
    } else {
        // Regular: price higher high, rsi lower high
        if (price2 <= price1) return null;
        if (rsi2 >= rsi1) return null;
    }
    return p2;
}

export function detectRsiBullishDivergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = detectRegularDivergence(bars, indicators.rsi, 'bullish');
    if (idx === null) return null;
    return {
        type: 'rsi_bullish_divergence',
        direction: 'bullish',
        phase: 'expected',
        detectedAt: idx,
    };
}

export function detectRsiBearishDivergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = detectRegularDivergence(bars, indicators.rsi, 'bearish');
    if (idx === null) return null;
    return {
        type: 'rsi_bearish_divergence',
        direction: 'bearish',
        phase: 'expected',
        detectedAt: idx,
    };
}

export function detectMacdHistogramBullishConvergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const macd = indicators.macd;
    if (macd.length < HISTOGRAM_CONVERGENCE_BARS) return null;
    const tail = macd.slice(-HISTOGRAM_CONVERGENCE_BARS);
    for (const p of tail) {
        if (p.histogram === null || !(p.histogram < 0)) return null;
    }
    for (let i = 1; i < tail.length; i++) {
        // Non-null asserted: prior loop guarantees histogram !== null for all tail elements.
        const prev = tail[i - 1]!.histogram!;
        const cur = tail[i]!.histogram!;
        // magnitude strictly decreasing (absolute value)
        if (!(Math.abs(cur) < Math.abs(prev))) return null;
    }
    return {
        type: 'macd_histogram_bullish_convergence',
        direction: 'bullish',
        phase: 'expected',
        detectedAt: macd.length - 1,
    };
}

export function detectMacdHistogramBearishConvergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const macd = indicators.macd;
    if (macd.length < HISTOGRAM_CONVERGENCE_BARS) return null;
    const tail = macd.slice(-HISTOGRAM_CONVERGENCE_BARS);
    for (const p of tail) {
        if (p.histogram === null || !(p.histogram > 0)) return null;
    }
    for (let i = 1; i < tail.length; i++) {
        // Non-null asserted: prior loop guarantees histogram !== null for all tail elements.
        const prev = tail[i - 1]!.histogram!;
        const cur = tail[i]!.histogram!;
        if (!(cur < prev)) return null;
    }
    return {
        type: 'macd_histogram_bearish_convergence',
        direction: 'bearish',
        phase: 'expected',
        detectedAt: macd.length - 1,
    };
}

function isSqueezePresent(
    bars: Bar[],
    indicators: IndicatorResult
): { lastIdx: number; pctB: number; slope: number } | null {
    const bb = indicators.bollinger;
    if (bb.length < SQUEEZE_LOOKBACK_BARS) return null;
    if (bars.length !== bb.length) return null;
    const lastIdx = bb.length - 1;
    const lastBB = bb[lastIdx];
    const widthLast = computeBbWidth(lastBB);
    if (widthLast === null) return null;

    const widths: number[] = [];
    for (let i = lastIdx - SQUEEZE_LOOKBACK_BARS + 1; i <= lastIdx; i++) {
        const p = bb[i];
        const w = computeBbWidth(p);
        if (w === null) continue;
        widths.push(w);
    }
    const rank = percentileRank(widthLast, widths);
    if (rank === null || rank > SQUEEZE_PERCENTILE) return null;

    const pctB = computePctB(bars[lastIdx].close, lastBB);
    if (pctB === null) return null;

    const ema20 = indicators.ema[20];
    if (ema20 === undefined) return null;
    const slope = computeEma20Slope(ema20, TREND_SLOPE_LOOKBACK);
    if (slope === null) return null;

    return { lastIdx, pctB, slope };
}

export function detectBollingerSqueezeBullish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const s = isSqueezePresent(bars, indicators);
    if (s === null) return null;
    if (s.pctB < SQUEEZE_PCT_B_THRESHOLD) return null;
    if (s.slope < 0) return null;
    return {
        type: 'bollinger_squeeze_bullish',
        direction: 'bullish',
        phase: 'expected',
        detectedAt: s.lastIdx,
    };
}

export function detectBollingerSqueezeBearish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const s = isSqueezePresent(bars, indicators);
    if (s === null) return null;
    if (s.pctB >= SQUEEZE_PCT_B_THRESHOLD) return null;
    if (s.slope > 0) return null;
    return {
        type: 'bollinger_squeeze_bearish',
        direction: 'bearish',
        phase: 'expected',
        detectedAt: s.lastIdx,
    };
}

function isWithinProximity(
    close: number,
    ma: number,
    side: 'above' | 'below'
): boolean {
    const distance = Math.abs(close - ma) / ma;
    if (distance > SR_PROXIMITY_PCT) return false;
    if (side === 'above') return close > ma;
    return close < ma;
}

export function detectSupportProximityBullish(
    bars: Bar[],
    _indicators: IndicatorResult
): Signal | null {
    if (bars.length < SR_APPROACH_LOOKBACK + 1) return null;
    const lastIdx = bars.length - 1;
    const closeLast = bars[lastIdx].close;
    const closePrev5 = bars[lastIdx - SR_APPROACH_LOOKBACK].close;
    if (!(closeLast < closePrev5)) return null; // must be falling

    for (const period of SR_MA_PERIODS) {
        if (bars.length < period) continue;
        // calculateMA returns a real number at lastIdx when bars.length >= period (checked above)
        const ma = calculateMA(bars, period)[lastIdx] as number;
        if (isWithinProximity(closeLast, ma, 'above')) {
            return {
                type: 'support_proximity_bullish',
                direction: 'bullish',
                phase: 'expected',
                detectedAt: lastIdx,
            };
        }
    }
    return null;
}

export function detectResistanceProximityBearish(
    bars: Bar[],
    _indicators: IndicatorResult
): Signal | null {
    if (bars.length < SR_APPROACH_LOOKBACK + 1) return null;
    const lastIdx = bars.length - 1;
    const closeLast = bars[lastIdx].close;
    const closePrev5 = bars[lastIdx - SR_APPROACH_LOOKBACK].close;
    if (!(closeLast > closePrev5)) return null; // must be rising

    for (const period of SR_MA_PERIODS) {
        if (bars.length < period) continue;
        // calculateMA returns a real number at lastIdx when bars.length >= period (checked above)
        const ma = calculateMA(bars, period)[lastIdx] as number;
        if (isWithinProximity(closeLast, ma, 'below')) {
            return {
                type: 'resistance_proximity_bearish',
                direction: 'bearish',
                phase: 'expected',
                detectedAt: lastIdx,
            };
        }
    }
    return null;
}
