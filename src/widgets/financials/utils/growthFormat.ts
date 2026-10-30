/**
 * 성장률 표시 변환.
 */

/** 분수를 퍼센트로 바꿀 때 곱하는 값. */
const PERCENT_PER_FRACTION = 100;

/**
 * 전년 대비 성장률 분수(0.5)를 표시용 퍼센트(50.0)로 바꾼다.
 *
 * `StatementTable`의 `pct` 포맷은 값을 그대로 `%`로 찍으므로 분수에 100을 곱해 넘겨야 한다.
 * `null`(그 기간 데이터 없음)은 그대로 둔다.
 */
export function toPercent(fraction: number | null): number | null {
    return fraction === null ? null : fraction * PERCENT_PER_FRACTION;
}
