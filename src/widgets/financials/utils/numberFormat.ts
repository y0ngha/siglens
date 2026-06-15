/**
 * Compact USD formatter: $1.2B, $340M, $5K.
 *
 * Module-level singleton — `Intl.NumberFormat` construction parses locale data
 * and is expensive, so it must not be re-created per call. Shared by every
 * financials widget that renders USD amounts (StatementTable, AxisScoreCard).
 */
export const usdFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'USD',
});
