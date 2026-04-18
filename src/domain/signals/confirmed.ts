import type { Bar, IndicatorResult, MACDResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
} from '@/domain/indicators/constants';
import { calculateMA } from '@/domain/indicators/ma';
import {
    CROSS_LOOKBACK_BARS,
    GOLDEN_CROSS_FAST_PERIOD,
    GOLDEN_CROSS_SLOW_PERIOD,
} from '@/domain/signals/constants';

export function detectRsiOversold(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const rsi = indicators.rsi;
    if (rsi.length === 0) return null;
    const lastIdx = rsi.length - 1;
    const last = rsi[lastIdx];
    if (last === null) return null;
    if (last >= RSI_OVERSOLD_LEVEL) return null;
    return {
        type: 'rsi_oversold',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}

export function detectRsiOverbought(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const rsi = indicators.rsi;
    if (rsi.length === 0) return null;
    const lastIdx = rsi.length - 1;
    const last = rsi[lastIdx];
    if (last === null) return null;
    if (last <= RSI_OVERBOUGHT_LEVEL) return null;
    return {
        type: 'rsi_overbought',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}

type CrossDirection = 'up' | 'down';

function findCross(
    fast: (number | null)[],
    slow: (number | null)[],
    lookback: number,
    direction: CrossDirection
): number | null {
    const len = Math.min(fast.length, slow.length);
    const start = Math.max(1, len - lookback);
    for (let i = start; i < len; i++) {
        const f = fast[i];
        const s = slow[i];
        const fPrev = fast[i - 1];
        const sPrev = slow[i - 1];
        if (f === null || s === null || fPrev === null || sPrev === null)
            continue;
        if (direction === 'up' && fPrev <= sPrev && f > s) return i;
        if (direction === 'down' && fPrev >= sPrev && f < s) return i;
    }
    return null;
}

export function detectGoldenCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    if (bars.length < GOLDEN_CROSS_SLOW_PERIOD + 1) return null;
    const fast =
        indicators.ma[GOLDEN_CROSS_FAST_PERIOD] ??
        calculateMA(bars, GOLDEN_CROSS_FAST_PERIOD);
    const slow = calculateMA(bars, GOLDEN_CROSS_SLOW_PERIOD);
    const crossIdx = findCross(fast, slow, CROSS_LOOKBACK_BARS, 'up');
    if (crossIdx === null) return null;
    return {
        type: 'golden_cross',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: crossIdx,
    };
}

export function detectDeathCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    if (bars.length < GOLDEN_CROSS_SLOW_PERIOD + 1) return null;
    const fast =
        indicators.ma[GOLDEN_CROSS_FAST_PERIOD] ??
        calculateMA(bars, GOLDEN_CROSS_FAST_PERIOD);
    const slow = calculateMA(bars, GOLDEN_CROSS_SLOW_PERIOD);
    const crossIdx = findCross(fast, slow, CROSS_LOOKBACK_BARS, 'down');
    if (crossIdx === null) return null;
    return {
        type: 'death_cross',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: crossIdx,
    };
}

function findMacdCross(
    points: MACDResult[],
    lookback: number,
    direction: CrossDirection
): number | null {
    const len = points.length;
    if (len < 2) return null;
    const start = Math.max(1, len - lookback);
    for (let i = start; i < len; i++) {
        const p = points[i];
        const prev = points[i - 1];
        if (
            p.macd === null ||
            p.signal === null ||
            prev.macd === null ||
            prev.signal === null
        )
            continue;
        if (direction === 'up' && prev.macd <= prev.signal && p.macd > p.signal)
            return i;
        if (
            direction === 'down' &&
            prev.macd >= prev.signal &&
            p.macd < p.signal
        )
            return i;
    }
    return null;
}

export function detectMacdBullishCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = findMacdCross(indicators.macd, CROSS_LOOKBACK_BARS, 'up');
    if (idx === null) return null;
    return {
        type: 'macd_bullish_cross',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: idx,
    };
}

export function detectMacdBearishCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = findMacdCross(indicators.macd, CROSS_LOOKBACK_BARS, 'down');
    if (idx === null) return null;
    return {
        type: 'macd_bearish_cross',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: idx,
    };
}

export function detectBollingerLowerBounce(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const bb = indicators.bollinger;
    if (bars.length < 2 || bb.length < 2) return null;
    const lastIdx = bars.length - 1;
    const prevBar = bars[lastIdx - 1];
    const curBar = bars[lastIdx];
    const prevBB = bb[lastIdx - 1];
    if (prevBB.lower === null) return null;
    if (prevBar.low > prevBB.lower) return null;
    if (curBar.close <= prevBar.close) return null;
    return {
        type: 'bollinger_lower_bounce',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}

export function detectBollingerUpperBreakout(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const bb = indicators.bollinger;
    if (bars.length === 0 || bb.length === 0) return null;
    const lastIdx = bars.length - 1;
    const curBar = bars[lastIdx];
    const curBB = bb[lastIdx];
    if (curBB.upper === null) return null;
    if (curBar.close <= curBB.upper) return null;
    return {
        type: 'bollinger_upper_breakout',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
