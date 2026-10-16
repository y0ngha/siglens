/**
 * drizzle `execute`(postgres-js) 결과의 영향 행 수. postgres-js의 결과 배열은 `count`(영향 행 수)를 속성으로 단다 — 없거나 숫자가
 * 아니면 0이다(`RETURNING` 없이 지운 행 수만 읽는 정리 쿼리용).
 */
export function affectedRows(result: unknown): number {
    return typeof result === 'object' &&
        result !== null &&
        'count' in result &&
        typeof result.count === 'number'
        ? result.count
        : 0;
}
