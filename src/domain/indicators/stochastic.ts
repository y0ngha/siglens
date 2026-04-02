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
export function calculateStochastic(
    bars: Bar[],
    kPeriod = STOCHASTIC_K_PERIOD,
    dPeriod = STOCHASTIC_D_PERIOD,
    smoothing = STOCHASTIC_SMOOTHING
): StochasticResult[] {
    if (bars.length === 0) return [];

    const fastK = calculateFastPercentK(bars, kPeriod);

    // Build Slow %K and %D using reduce to accumulate non-null Fast %K values
    const { results } = fastK.reduce<{
        fastKBuffer: number[];
        slowKBuffer: number[];
        results: StochasticResult[];
    }>(
        (acc, fk) => {
            if (fk === null) {
                return {
                    ...acc,
                    results: [
                        ...acc.results,
                        { percentK: null, percentD: null },
                    ],
                };
            }

            const nextFastKBuffer = [...acc.fastKBuffer, fk];
            const slowK = sma(nextFastKBuffer, smoothing);

            if (slowK === null) {
                return {
                    fastKBuffer: nextFastKBuffer,
                    slowKBuffer: acc.slowKBuffer,
                    results: [
                        ...acc.results,
                        { percentK: null, percentD: null },
                    ],
                };
            }

            const clampedSlowK = Math.min(
                PERCENTAGE_UPPER_BOUND,
                Math.max(PERCENTAGE_LOWER_BOUND, slowK)
            );
            const nextSlowKBuffer = [...acc.slowKBuffer, clampedSlowK];
            const percentD = sma(nextSlowKBuffer, dPeriod);

            const clampedPercentD =
                percentD !== null
                    ? Math.min(
                          PERCENTAGE_UPPER_BOUND,
                          Math.max(PERCENTAGE_LOWER_BOUND, percentD)
                      )
                    : null;

            return {
                fastKBuffer: nextFastKBuffer,
                slowKBuffer: nextSlowKBuffer,
                results: [
                    ...acc.results,
                    {
                        percentK: clampedSlowK,
                        percentD: clampedPercentD,
                    },
                ],
            };
        },
        { fastKBuffer: [], slowKBuffer: [], results: [] }
    );

    return results;
}
