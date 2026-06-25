/**
 * FMP API 숫자 필드를 유한 숫자 또는 null로 변환한다.
 * undefined/NaN/Infinity → null.
 *
 * `financialStatementsClient`의 `num()`과 `fundamentalClient`의 `toFiniteNumber()`가
 * 동일 구현을 가지고 있어 단일 출처로 통합. 두 모듈이 이 파일을 import한다.
 */
export function toFiniteNumber(
    value: number | null | undefined
): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
