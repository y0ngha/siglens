/**
 * Simple Moving Average for a number array.
 * Returns null when there are fewer values than the period.
 */
export function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    return values.slice(-period).reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Typical Price of a bar: (high + low + close) / 3
 */
export function typicalPrice(high: number, low: number, close: number): number {
    return (high + low + close) / 3;
}

/**
 * Population standard deviation of a number array.
 * Returns null when there are fewer values than the period.
 */
export function stdDev(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const window = values.slice(-period);
    const mean = window.reduce((sum, v) => sum + v, 0) / period;
    const variance =
        window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    return Math.sqrt(variance);
}

/**
 * Rolling maximum of the last `period` values.
 * Returns null when there are fewer values than the period.
 */
export function rollingHighest(
    values: number[],
    period: number
): number | null {
    if (values.length < period) return null;
    return Math.max(...values.slice(-period));
}

/**
 * Rolling minimum of the last `period` values.
 * Returns null when there are fewer values than the period.
 */
export function rollingLowest(values: number[], period: number): number | null {
    if (values.length < period) return null;
    return Math.min(...values.slice(-period));
}

/**
 * Linear regression value at the end of the window (offset = 0).
 * Fits a least-squares line to the last `period` values and returns
 * the predicted value at the most recent bar.
 * Returns null when there are fewer values than the period.
 *
 * Equivalent to PineScript: linreg(source, length, 0)
 */
export function linreg(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const window = values.slice(-period);
    const n = period;
    // x = [0, 1, ..., n-1], y = window
    const sumX = (n * (n - 1)) / 2;
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY = window.reduce((sum, v) => sum + v, 0);
    const sumXY = window.reduce((sum, v, i) => sum + i * v, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return intercept + slope * (n - 1);
}
