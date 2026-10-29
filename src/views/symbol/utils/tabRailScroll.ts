/**
 * 가로로 넘치는 탭 레일에서 활성 탭을 보이게 할 스크롤 위치 계산.
 */

/** 레일 안에서 활성 탭이 차지하는 가로 구간(px, 레일 콘텐츠 좌표). */
export interface TabSpan {
    readonly left: number;
    readonly width: number;
}

/** 레일의 현재 가로 뷰포트(px). */
export interface RailViewport {
    readonly scrollLeft: number;
    readonly clientWidth: number;
}

/**
 * 활성 탭을 레일 안으로 끌어올 `scrollLeft`. 이미 다 보이면 null — 사용자가 손으로 맞춰
 * 둔 위치를 내비게이션마다 빼앗지 않는다. 왼쪽으로 벗어났으면 탭의 왼쪽 끝을, 오른쪽으로
 * 벗어났으면 오른쪽 끝을 레일 가장자리에 붙인다.
 */
export function railScrollLeftFor(
    tab: TabSpan,
    rail: RailViewport
): number | null {
    const right = tab.left + tab.width;
    const viewRight = rail.scrollLeft + rail.clientWidth;
    if (tab.left >= rail.scrollLeft && right <= viewRight) return null;
    return tab.left < rail.scrollLeft ? tab.left : right - rail.clientWidth;
}
