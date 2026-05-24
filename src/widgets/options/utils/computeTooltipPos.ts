/**
 * Pure helpers and layout constants for the OI chart's floating tooltip.
 *
 * Extracted out of `OpenInterestChart.tsx` so the clamping math can be
 * exercised by unit tests without instantiating React or the SVG container.
 * The function is pure — its output depends only on its arguments and these
 * module-level constants.
 */
import type { PointerEvent } from 'react';

/** Container-relative coordinates the floating tooltip is anchored at. */
export interface TooltipPosition {
    x: number;
    y: number;
}

// Tooltip이 커서 위로 띄울 세로 오프셋 (px). 위로 띄워야 막대를 가리지 않는다.
export const TOOLTIP_CURSOR_OFFSET_Y_PX = 8;
// Tooltip min-width의 단일 진실 원천 (px). className의 `min-w-[var(--tooltip-min-w)]`
// 와 `TOOLTIP_HALF_WIDTH_PX` 둘 다 이 값에서 파생되므로, 이 상수만 바꾸면
// 좌우 경계 클램핑과 실제 가시 너비가 자동으로 동기화된다.
export const TOOLTIP_MIN_WIDTH_PX = 180;
// 좌우 경계 클램핑용 — `-translate-x-1/2`로 anchor 좌우로 절반씩 뻗으므로 절반 너비.
export const TOOLTIP_HALF_WIDTH_PX = TOOLTIP_MIN_WIDTH_PX / 2;
// 뷰포트 경계와 tooltip 사이 여유 (px). 컨테이너 모서리에 딱 붙지 않도록.
export const TOOLTIP_VIEWPORT_PADDING_PX = 8;
// Tooltip 카드 자체의 대략적 높이. 정확한 측정 대신 추정값으로 상단 클램핑에 사용.
export const TOOLTIP_APPROX_HEIGHT_PX = 110;
// DOM tooltip id — `role="tooltip"` 요소와 hit-rect의 `aria-describedby`가
// 공유하는 anchor. WAI-ARIA tooltip 패턴.
export const TOOLTIP_ELEMENT_ID = 'oi-chart-tooltip';

/**
 * Compute container-relative tooltip coordinates from a pointer event,
 * clamping to viewport boundaries so the tooltip can't escape the chart
 * container even when the cursor is near an edge.
 *
 * Pure — captures no state or refs, only its arguments and the layout
 * constants exported above.
 */
export function computeTooltipPos(
    event: PointerEvent<SVGRectElement>,
    rect: DOMRect
): TooltipPosition {
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    // 좌우 경계 클램핑 — tooltip은 `-translate-x-1/2`로 좌우 절반이
    // anchor 좌우로 뻗어나가므로 절반 너비 + 여유만큼 안쪽에 고정.
    const clampedX = Math.min(
        Math.max(rawX, TOOLTIP_HALF_WIDTH_PX + TOOLTIP_VIEWPORT_PADDING_PX),
        rect.width - TOOLTIP_HALF_WIDTH_PX - TOOLTIP_VIEWPORT_PADDING_PX
    );
    // 상단 경계 클램핑 — tooltip은 `-translate-y-full`로 anchor 위로
    // 뻗으므로 anchor가 너무 위면 tooltip이 컨테이너 밖으로 튀어나간다.
    const minY =
        TOOLTIP_APPROX_HEIGHT_PX +
        TOOLTIP_VIEWPORT_PADDING_PX +
        TOOLTIP_CURSOR_OFFSET_Y_PX;
    const clampedY = Math.max(rawY, minY);
    return { x: clampedX, y: clampedY - TOOLTIP_CURSOR_OFFSET_Y_PX };
}
