/**
 * 짧은 목록을 되풀이해 원하는 길이의 목록을 만든다 — 골격 문단 줄 폭처럼 몇 개의
 * 값을 번갈아 쓰는 자리에 쓴다.
 */

/**
 * `items`를 처음부터 되풀이하며 `count`개를 고른다. `items`가 비었거나 `count`가
 * 0 이하면 빈 배열이다.
 */
export function cycleTake<T>(items: readonly T[], count: number): T[] {
    if (items.length === 0 || count <= 0) return [];
    return Array.from(
        { length: count },
        // 위에서 길이를 확인해 인덱스가 늘 범위 안이다 — `noUncheckedIndexedAccess`가 넓힌 `undefined`만 걷어낸다.
        (_, i) => items[i % items.length] as T
    );
}
