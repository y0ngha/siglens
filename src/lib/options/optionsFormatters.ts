/**
 * Shared formatters for options metrics rendered on the symbol page.
 *
 * `OptionsMetricsRow` (options tab metric grid) and the options chain table
 * render the same underlying numbers — Max Pain, Put/Call ratio, ATM IV, and
 * implied move — so they must agree on NaN/null rendering. Keeping the
 * formatters here ensures one path can't drift and surface a bare `'NaN'`
 * while the other shows `'—'`.
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

// `toFixed(1)`이 "0.0"으로 반올림되는 경계값. 정상 시장의 IV는 보통 5% 이상이고
// `±implied move`도 0.05% 이상이라, 이 임계 아래의 값은 noise(또는 Yahoo가 채우다
// 만 흔적)로 보고 placeholder로 통합 안내한다.
const PERCENT_DISPLAY_FLOOR = 0.05;

/**
 * Format ATM implied volatility (fraction).
 *
 * null/undefined/NaN → `'—'`. `value <= 0`도 `'—'`로 처리하고, 추가로
 * `value * 100 < 0.05`인 작은 양수도 `'—'`로 안내한다 — Yahoo가 pre-market /
 * pre-pre 구간에서 ATM contract의 IV를 0 또는 sub-percent noise로 채워 보내는
 * 경우가 있어, 그대로 `0.0%`로 표시하면 "변동성이 정말 0이다"라는 잘못된
 * 인상을 준다.
 */
export function formatAtmIv(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value) || value <= 0) return '—';
    const pct = value * 100;
    if (pct < PERCENT_DISPLAY_FLOOR) return '—';
    return `${pct.toFixed(1)}%`;
}

/**
 * Format implied move %.
 *
 * null/undefined/NaN → `'—'`. `value <= 0`도 `'—'`이고, `value < 0.05`인 작은
 * 양수도 `'—'`로 안내한다 — core의 `calculateImpliedMove`는 `atmIv * sqrt(...)
 * * 100`이라 ATM IV가 0이거나 sub-percent noise이면 결과가 0/근사 0으로
 * 떨어진다 (위 ATM IV와 동일 사유).
 */
export function formatImpliedMove(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value) || value <= 0) return '—';
    if (value < PERCENT_DISPLAY_FLOOR) return '—';
    return `±${value.toFixed(1)}%`;
}
