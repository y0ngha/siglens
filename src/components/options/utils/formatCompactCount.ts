/**
 * Format a non-negative integer in compact notation: 1.2M, 4.5k, 750.
 * Used by both the OI chart and the volume chart for axis labels — the
 * two charts share the same y-scale rendering language so their thresholds
 * (1M, 1k) and rounding (one decimal place) are deliberately identical.
 */
const MILLION = 1_000_000;
const THOUSAND = 1_000;

export function formatCompactCount(value: number): string {
    if (value >= MILLION) return `${(value / MILLION).toFixed(1)}M`;
    if (value >= THOUSAND) return `${(value / THOUSAND).toFixed(1)}k`;
    return String(value);
}
