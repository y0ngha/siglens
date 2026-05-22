/**
 * Format a non-negative integer in compact notation: 1.2M, 4.5k, 750.
 * Used by both the OI chart and the volume chart for axis labels — the
 * two charts share the same y-scale rendering language so their thresholds
 * (1M, 1k) and rounding (one decimal place) are deliberately identical.
 */
export function formatCompactCount(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
}
