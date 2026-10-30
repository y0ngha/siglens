/**
 * 배열이 아닌 일반 객체인지 가르는 타입 가드. 지표 구조(`IndicatorResult`)처럼 모양이 필드마다 다른 값을
 * `as` 없이 순회할 때 쓴다. `null`과 배열은 객체로 치지 않는다.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
