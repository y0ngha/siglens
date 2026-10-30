/**
 * 차트 호버 툴팁의 화면 배치 — 커서 근처에 두되 뷰포트 가장자리에서 반대편으로 뒤집는다.
 */
export interface TooltipPosition {
    left: number;
    top: number;
}

// Conservative tooltip footprint used only to decide which side of the cursor to
// place it on (so it doesn't clip past the viewport edge). Exact size varies with
// series count; over-estimating just flips a little earlier, which is harmless.
const TOOLTIP_EST_WIDTH = 200;
const TOOLTIP_EST_HEIGHT = 140;
const TOOLTIP_GAP = 12;

/**
 * Place the tooltip near the cursor, flipping to the opposite side when it would
 * overflow the right/bottom viewport edge. Runs in a pointer handler, so `window`
 * is always defined.
 */
export function placeTooltip(
    clientX: number,
    clientY: number
): TooltipPosition {
    const overflowRight =
        clientX + TOOLTIP_GAP + TOOLTIP_EST_WIDTH > window.innerWidth;
    const overflowBottom =
        clientY + TOOLTIP_GAP + TOOLTIP_EST_HEIGHT > window.innerHeight;
    const left = overflowRight
        ? clientX - TOOLTIP_EST_WIDTH - TOOLTIP_GAP
        : clientX + TOOLTIP_GAP;
    const top = overflowBottom
        ? clientY - TOOLTIP_EST_HEIGHT - TOOLTIP_GAP
        : clientY + TOOLTIP_GAP;
    return {
        left: Math.max(TOOLTIP_GAP, left),
        top: Math.max(TOOLTIP_GAP, top),
    };
}
