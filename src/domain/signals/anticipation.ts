import type { Bar, BollingerResult, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    DIVERGENCE_FRESHNESS_BARS,
    DIVERGENCE_LOOKBACK_BARS,
    HISTOGRAM_CONVERGENCE_BARS,
    PIVOT_WINDOW,
} from '@/domain/signals/constants';

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
    if (bb.upper === null || bb.middle === null || bb.lower === null) return null;
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
    const below = xs.filter((x) => x < value).length;
    const equal = xs.filter((x) => x === value).length;
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
            ? bars.slice(windowStart).map((b) => b.low)
            : bars.slice(windowStart).map((b) => b.high);
    const pivotsLocal =
        kind === 'bullish'
            ? findPivotLows(series, PIVOT_WINDOW)
            : findPivotHighs(series, PIVOT_WINDOW);

    if (pivotsLocal.length < 2) return null;

    // Convert local-window indices back to absolute indices
    const pivots = pivotsLocal.map((i) => i + windowStart);
    const p1 = pivots[pivots.length - 2];
    const p2 = pivots[pivots.length - 1];

    // Freshness: second pivot must be within last N bars
    if (lastIdx - p2 > DIVERGENCE_FRESHNESS_BARS) return null;

    const price1 = kind === 'bullish' ? bars[p1].low : bars[p1].high;
    const price2 = kind === 'bullish' ? bars[p2].low : bars[p2].high;
    const rsi1 = rsi[p1];
    const rsi2 = rsi[p2];
    if (
        rsi1 === null ||
        rsi2 === null ||
        rsi1 === undefined ||
        rsi2 === undefined
    ) {
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
        const prev = tail[i - 1]!.histogram as number;
        const cur = tail[i]!.histogram as number;
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
        const prev = tail[i - 1]!.histogram as number;
        const cur = tail[i]!.histogram as number;
        if (!(cur < prev)) return null;
    }
    return {
        type: 'macd_histogram_bearish_convergence',
        direction: 'bearish',
        phase: 'expected',
        detectedAt: macd.length - 1,
    };
}
