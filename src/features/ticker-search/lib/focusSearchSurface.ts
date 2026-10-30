/**
 * 홈 히어로에서 지금 **보이는** 검색 표면으로 포커스를 보낸다. 모바일은 오버레이 트리거
 * 버튼, 데스크톱(`lg`)은 자동완성 입력이다 — 브레이크포인트마다 한쪽이 `display:none`이다.
 *
 * `display:none`인 요소에 `focus()`를 주면 조용히 실패하고 포커스가 `<body>`로 떨어진다.
 * `offsetParent`로 판정하면 레이아웃이 없는 jsdom에서 항상 숨김으로 잡히므로 계산된
 * 스타일을 본다.
 *
 * @param trigger 모바일 오버레이 트리거. provider가 없으면 렌더되지 않아 null이다.
 * @param desktopSurface 데스크톱 자동완성을 감싼 요소. 그 안의 입력으로 보낸다.
 */
export function focusSearchSurface(
    trigger: HTMLElement | null,
    desktopSurface: HTMLElement | null
): void {
    if (trigger && getComputedStyle(trigger).display !== 'none') {
        trigger.focus();
        return;
    }
    desktopSurface?.querySelector('input')?.focus();
}
