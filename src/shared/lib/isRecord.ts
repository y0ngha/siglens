/**
 * `unknown` 값을 `as` 없이 키-값 객체로 좁히는 공용 타입 가드.
 * `typeof === 'object'`와 `null` 제외만 판정하므로 배열도 true다.
 * 배열을 걸러내야 하면 `isPlainRecord`를 쓴다.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
