/**
 * Shared formatters for options metrics rendered on the symbol page.
 *
 * Both `OptionsSignalCards` (chart-page chip row) and `OptionsMetricsRow`
 * (options tab metric grid) render the same underlying numbers — Max Pain,
 * Put/Call ratio, ATM IV, and implied move — so they must agree on NaN/null
 * rendering. Keeping the formatters here ensures one path can't drift and
 * surface a bare `'NaN'` while the other shows `'—'`.
 *
 * siglens-core PR #86 R12 widened `maxPain` and `putCallRatio` to
 * `number | null` (NaN/Infinity were silently JSON-stringified to "null",
 * defeating downstream null-handling). These formatters accept the new
 * union — pre-R12 callers passing NaN still render `'—'` for backward
 * compatibility.
 */

/** Format a Max Pain strike. null/NaN → `'—'`, otherwise `$<rounded>` with comma grouping. */
export function formatMaxPain(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `$${Math.round(value).toLocaleString()}`;
}

/**
 * Format a put/call ratio. `+Infinity` (no calls, some puts) → `'∞'`,
 * null/NaN → `'—'`, otherwise two-decimal fixed.
 */
export function formatPutCallRatio(value: number | null | undefined): string {
    if (value === Number.POSITIVE_INFINITY) return '∞';
    if (value == null || Number.isNaN(value)) return '—';
    return value.toFixed(2);
}

/** Format ATM implied volatility (fraction). null/undefined/NaN → `'—'`, otherwise `<pct>%` with 1 decimal. */
export function formatAtmIv(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${(value * 100).toFixed(1)}%`;
}

/** Format implied move %. null/undefined/NaN → `'—'`, otherwise `±<pct>%` with 1 decimal. */
export function formatImpliedMove(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `±${value.toFixed(1)}%`;
}
