/**
 * 두 쿼리 키가 같은 요소 열인지. 길이를 먼저 비교한다 — 짧은 쪽만 훑어 같다고
 * 오판하는 것을 막고, 다르면 즉시 탈락시킨다.
 */
export function isSameQueryKey(
    a: readonly unknown[],
    b: readonly unknown[]
): boolean {
    return a.length === b.length && a.every((part, i) => part === b[i]);
}
