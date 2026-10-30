/**
 * 포커스가 `container` 안에 있는지.
 *
 * Escape로 팝오버를 닫을 때 포커스를 트리거로 되돌릴지 가르는 데 쓴다 — 포커스가
 * 팝오버 밖(검색창 등)에 있으면 되돌리는 순간 사용자의 입력 위치를 빼앗는다.
 */
export function isFocusWithin(container: HTMLElement | null): boolean {
    return container?.contains(document.activeElement) ?? false;
}
