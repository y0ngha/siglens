/**
 * FMP API 숫자 필드를 유한 숫자 또는 null로 변환한다.
 * number가 아닌 값(undefined/null/문자열 등)과 NaN/Infinity → null.
 *
 * `Number(...)`로 강제하지 않는다 — `Number(null)`은 0이고 그건 유한수라, 발표되지
 * 않은 지표(`actual: null`)가 "0으로 발표됨"이 된다.
 */
export function toFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
