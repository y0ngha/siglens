import type { Bar, IndicatorResult, TrendState } from '@/domain/types';
import {
    TREND_EMA_PERIOD,
    TREND_SLOPE_LOOKBACK,
    TREND_SLOPE_THRESHOLD,
} from '@/domain/signals/constants';

export function classifyTrend(
    bars: Bar[],
    indicators: IndicatorResult
): TrendState {
    const ema20 = indicators.ema[TREND_EMA_PERIOD];
    if (ema20 === undefined) return 'sideways';
    if (ema20.length < TREND_SLOPE_LOOKBACK + 1) return 'sideways';

    const lastIdx = ema20.length - 1;
    const prevIdx = lastIdx - TREND_SLOPE_LOOKBACK;
    const emaLast = ema20[lastIdx];
    const emaPrev = ema20[prevIdx];
    if (emaLast === null || emaPrev === null || emaPrev === 0) {
        return 'sideways';
    }

    const slope = (emaLast - emaPrev) / emaPrev;
    const closeLast = bars[bars.length - 1]?.close;
    if (closeLast === undefined) return 'sideways';

    if (slope >= TREND_SLOPE_THRESHOLD && closeLast > emaLast) return 'uptrend';
    if (slope <= -TREND_SLOPE_THRESHOLD && closeLast < emaLast)
        return 'downtrend';
    return 'sideways';
}
