import type { Bar, StochasticResult } from '@/domain/types';
import {
    STOCHASTIC_K_PERIOD,
    STOCHASTIC_D_PERIOD,
    STOCHASTIC_SMOOTHING,
} from '@/domain/indicators/constants';

/**
 * Simple Moving Average for a number array.
 * Returns null when there are fewer values than the period.
 */
function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    return values.slice(-period).reduce((sum, v) => sum + v, 0) / period;
}

const MIDPOINT_PERCENTAGE = 50;
const PERCENTAGE_UPPER_BOUND = 100;
const PERCENTAGE_LOWER_BOUND = 0;

/**
 * Calculate Fast %K values from bars.
 * Fast %K = (close - lowest low over kPeriod) / (highest high over kPeriod - lowest low over kPeriod) * 100
 * Returns null for the first kPeriod - 1 bars.
 */
function calculateFastPercentK(
    bars: Bar[],
    kPeriod: number
): (number | null)[] {
    return bars.map((bar, i) => {
        if (i < kPeriod - 1) return null;

        const periodBars = bars.slice(i - kPeriod + 1, i + 1);
        const highestHigh = Math.max(...periodBars.map(b => b.high));
        const lowestLow = Math.min(...periodBars.map(b => b.low));
        const range = highestHigh - lowestLow;

        if (range === 0) return MIDPOINT_PERCENTAGE;
        return ((bar.close - lowestLow) / range) * 100;
    });
}

/**
 * Apply SMA smoothing to Fast %K to get Slow %K, then compute %D as SMA of Slow %K.
 * Slow Stochastic (14, 3, 3):
 *   - Fast %K: (close - LL14) / (HH14 - LL14) * 100
 *   - Slow %K (%K displayed): SMA(Fast %K, smoothing=3)
 *   - Slow %D (%D displayed): SMA(Slow %K, dPeriod=3)
 */
/**
 * Clamp a value to [PERCENTAGE_LOWER_BOUND, PERCENTAGE_UPPER_BOUND].
 */
function clampPercentage(value: number): number {
    return Math.min(
        PERCENTAGE_UPPER_BOUND,
        Math.max(PERCENTAGE_LOWER_BOUND, value)
    );
}

export function calculateStochastic(
    bars: Bar[],
    kPeriod = STOCHASTIC_K_PERIOD,
    dPeriod = STOCHASTIC_D_PERIOD,
    smoothing = STOCHASTIC_SMOOTHING
): StochasticResult[] {
    if (bars.length === 0) return [];

    const fastK = calculateFastPercentK(bars, kPeriod);

    // Extract non-null Fast %K values, then compute Slow %K via SMA
    const validFastK = fastK.filter((v): v is number => v !== null);
    const slowKValues: (number | null)[] = validFastK.map((_, i, arr) =>
        sma(arr.slice(Math.max(0, i - smoothing + 1), i + 1), smoothing)
    );
    const clampedSlowK: (number | null)[] = slowKValues.map(v =>
        v !== null ? clampPercentage(v) : null
    );

    // Extract non-null Slow %K values, then compute %D via SMA
    const numericSlowK = clampedSlowK.filter((v): v is number => v !== null);
    const percentDValues: (number | null)[] = numericSlowK.map((_, i, arr) =>
        sma(arr.slice(Math.max(0, i - dPeriod + 1), i + 1), dPeriod)
    );
    const clampedPercentD: (number | null)[] = percentDValues.map(v =>
        v !== null ? clampPercentage(v) : null
    );

    // Map back to original bar indices
    const nullOffset = kPeriod - 1;
    const slowKOffset = smoothing - 1;

    return fastK.map((fk, i): StochasticResult => {
        if (fk === null) return { percentK: null, percentD: null };

        const validIndex = i - nullOffset;
        const percentK = clampedSlowK[validIndex] ?? null;

        if (percentK === null) return { percentK: null, percentD: null };

        const slowKIndex = validIndex - slowKOffset;
        const percentD =
            slowKIndex >= 0 ? (clampedPercentD[slowKIndex] ?? null) : null;

        return { percentK, percentD };
    });
}
