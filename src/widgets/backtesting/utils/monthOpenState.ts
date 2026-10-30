/** 월(`<details>`)별로 떠나기 전 펼침 상태를 기억하는 맵. */
export type MonthOpenSnapshot = Map<HTMLDetailsElement, boolean>;

/**
 * 모든 월을 펼친다. 아직 기억하지 않은 월(서버가 새로 그린 것 포함)은 펼치기 **전**
 * 상태를 `snapshot`에 먼저 적어 둔다. 지금 목록에 없는 월(새로고침으로 DOM에서 빠진 노드)은
 * 되돌릴 대상이 아니므로 `snapshot`에서 지워, 종목 탭에 오래 머물러도 분리된 노드가 쌓이지 않게 한다.
 */
export function openAllMonths(
    months: readonly HTMLDetailsElement[],
    snapshot: MonthOpenSnapshot
): void {
    const current = new Set(months);
    Array.from(snapshot.keys())
        .filter(month => !current.has(month))
        .forEach(month => snapshot.delete(month));
    months
        .filter(month => !snapshot.has(month))
        .forEach(month => snapshot.set(month, month.open));
    months.forEach(month => {
        month.open = true;
    });
}

/** `snapshot`에 기억된 펼침 상태로 되돌린다. 기억에 없는 월은 건드리지 않는다. */
export function restoreMonths(
    months: readonly HTMLDetailsElement[],
    snapshot: ReadonlyMap<HTMLDetailsElement, boolean>
): void {
    months.forEach(month => {
        month.open = snapshot.get(month) ?? month.open;
    });
}
