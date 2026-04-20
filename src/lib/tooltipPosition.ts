/**
 * 트리거와 툴팁 엘리먼트의 bounding rect 기반으로 툴팁이 뷰포트 안에
 * 들어오는 `position: fixed` 좌표를 계산한다.
 *
 * - 기본은 트리거 위쪽 표시, 공간이 부족하면 아래로 뒤집는다.
 * - 좌우는 뷰포트 패딩을 고려한 center 정렬.
 * - 순수 함수 — DOM 쓰기 없음. 읽기만 수행(getBoundingClientRect).
 */

export const TOOLTIP_VIEWPORT_PADDING = 8;
export const TOOLTIP_GAP = 6;

export interface TooltipPosition {
    readonly top: number;
    readonly left: number;
}

export function getTooltipPosition(
    triggerRect: DOMRect,
    tooltipEl: HTMLElement,
    viewportWidth: number
): TooltipPosition {
    const tooltipRect = tooltipEl.getBoundingClientRect();
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
