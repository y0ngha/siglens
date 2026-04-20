/** triggerRect·tooltipRect 기반으로 툴팁의 `position: fixed` 좌표를 계산한다. 위쪽 기본, 공간 부족 시 아래로. */

export const TOOLTIP_VIEWPORT_PADDING = 8;
export const TOOLTIP_GAP = 6;

export interface TooltipPosition {
    readonly top: number;
    readonly left: number;
}

export function getTooltipPosition(
    triggerRect: DOMRect,
    tooltipRect: DOMRect,
    viewportWidth: number
): TooltipPosition {
    const aboveTop = triggerRect.top - tooltipRect.height - TOOLTIP_GAP;
    const top =
        aboveTop < TOOLTIP_VIEWPORT_PADDING
            ? triggerRect.bottom + TOOLTIP_GAP
            : aboveTop;
    const rawLeft =
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const maxLeft =
        viewportWidth - tooltipRect.width - TOOLTIP_VIEWPORT_PADDING;
    const left = Math.max(TOOLTIP_VIEWPORT_PADDING, Math.min(rawLeft, maxLeft));

    return { top, left };
}
