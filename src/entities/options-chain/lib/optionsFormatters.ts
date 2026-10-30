/**
 * 표시할 수 없는 지표 자리에 쓰는 placeholder. `OptionsMetricsRow`(stale OI 시나리오에서
 * metric을 일괄 대체)와 아래 formatter들의 null/NaN 분기가 같은 글자를 쓰도록 export해
 * 코드 수준에서 강제한다 — 한쪽 표기만 바뀌면 같은 자리에 서로 다른 placeholder가 보인다.
 */
export const METRIC_PLACEHOLDER = '-';

/**
 * `toFixed(1)`이 "0.0"으로 반올림되는 경계값(%). 정상 시장의 IV는 보통 5% 이상이고
 * `±implied move`도 0.05% 이상이라, 이 임계 아래의 값은 noise(또는 Yahoo가 채우다 만 흔적)로
 * 보고 placeholder로 통합 안내한다. boundary 테스트가 이 상수에서 값을 derive한다.
 */
export const PERCENT_DISPLAY_FLOOR = 0.05;

/** Max Pain 행사가를 표시한다. null/NaN이면 `'-'`, 아니면 반올림해 천 단위 쉼표를 넣은 `$<값>`이다. */
export function formatMaxPain(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return METRIC_PLACEHOLDER;
    return `$${Math.round(value).toLocaleString()}`;
}

/**
 * put/call ratio를 표시한다. `+Infinity`(콜 없이 풋만 있음)면 `'∞'`, null/NaN이면 `'-'`,
 * 아니면 소수 둘째 자리까지다.
 */
export function formatPutCallRatio(value: number | null | undefined): string {
    if (value === Number.POSITIVE_INFINITY) return '∞';
    if (value == null || Number.isNaN(value)) return METRIC_PLACEHOLDER;
    return value.toFixed(2);
}

/**
 * ATM 내재변동성(분수)을 표시한다.
 *
 * null/undefined/NaN이면 `'-'`. `value <= 0`도 `'-'`로 처리하고, 추가로
 * `value * 100 < 0.05`인 작은 양수도 `'-'`로 안내한다 — Yahoo가 pre-market /
 * pre-pre 구간에서 ATM contract의 IV를 0 또는 sub-percent noise로 채워 보내는
 * 경우가 있어, 그대로 `0.0%`로 표시하면 "변동성이 정말 0이다"라는 잘못된
 * 인상을 준다.
 */
export function formatAtmIv(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value) || value <= 0)
        return METRIC_PLACEHOLDER;
    const pct = value * 100;
    if (pct < PERCENT_DISPLAY_FLOOR) return METRIC_PLACEHOLDER;
    return `${pct.toFixed(1)}%`;
}

/**
 * 내재 변동폭(%)을 표시한다.
 *
 * null/undefined/NaN이면 `'-'`. `value <= 0`도 `'-'`이고, `value < 0.05`인 작은
 * 양수도 `'-'`로 안내한다 — core의 `calculateImpliedMove`는 `atmIv * sqrt(...)
 * * 100`이라 ATM IV가 0이거나 sub-percent noise이면 결과가 0/근사 0으로
 * 떨어진다 (위 ATM IV와 동일 사유).
 */
export function formatImpliedMove(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value) || value <= 0)
        return METRIC_PLACEHOLDER;
    if (value < PERCENT_DISPLAY_FLOOR) return METRIC_PLACEHOLDER;
    return `±${value.toFixed(1)}%`;
}
