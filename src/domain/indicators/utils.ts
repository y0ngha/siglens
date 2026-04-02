/**
 * Simple Moving Average for a number array.
 * Returns null when there are fewer values than the period.
 */
export function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    return values.slice(-period).reduce((sum, v) => sum + v, 0) / period;
}
