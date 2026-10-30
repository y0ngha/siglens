/**
 * `unknown` 값을 `as` 없이 배열이 아닌 일반 객체로 좁히는 타입 가드.
 * `isRecord`와 달리 배열을 거른다 — SSE/JSON처럼 신뢰할 수 없는 입력에서
 * 배열이 객체 자리에 들어오면 안 될 때 쓴다. 배열도 허용하려면 `isRecord`를 쓴다.
 */
export function isPlainRecord(
    value: unknown
): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
