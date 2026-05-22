/**
 * Unit tests for `computeTooltipPos`.
 *
 * Pure function — no DOM rendering needed. We hand-craft minimal pointer
 * event / DOMRect shapes (only the fields the function reads) and cast
 * through `unknown` to satisfy the public type signature.
 */
import type { PointerEvent } from 'react';
import {
    computeTooltipPos,
    TOOLTIP_APPROX_HEIGHT_PX,
    TOOLTIP_CURSOR_OFFSET_Y_PX,
    TOOLTIP_HALF_WIDTH_PX,
    TOOLTIP_VIEWPORT_PADDING_PX,
} from '@/components/options/utils/computeTooltipPos';

// 컨테이너 너비. 좌우 클램핑 경계가 양쪽 모두 유효하려면 절반 너비 + 패딩의
// 두 배보다 충분히 커야 한다 (현재 값 196px).
const CONTAINER_WIDTH = 600;
const CONTAINER_HEIGHT = 240;

function makeEvent(
    clientX: number,
    clientY: number
): PointerEvent<SVGRectElement> {
    return {
        clientX,
        clientY,
    } as unknown as PointerEvent<SVGRectElement>;
}

function makeRect(): DOMRect {
    return {
        left: 0,
        top: 0,
        width: CONTAINER_WIDTH,
        height: CONTAINER_HEIGHT,
    } as DOMRect;
}

describe('computeTooltipPos', () => {
    // 좌우 양쪽 클램핑이 모두 활성화될 수 있는 안전한 anchor x 범위.
    const leftClampThreshold =
        TOOLTIP_HALF_WIDTH_PX + TOOLTIP_VIEWPORT_PADDING_PX;
    const rightClampThreshold =
        CONTAINER_WIDTH - TOOLTIP_HALF_WIDTH_PX - TOOLTIP_VIEWPORT_PADDING_PX;
    // 상단 클램핑이 시작되는 y의 최소값. cursor offset만큼 빼기 전이라
    // `minY` 자체가 결과 y + offset이 된다.
    const topClampMinAnchorY =
        TOOLTIP_APPROX_HEIGHT_PX +
        TOOLTIP_VIEWPORT_PADDING_PX +
        TOOLTIP_CURSOR_OFFSET_Y_PX;

    it('cursor가 컨테이너 가운데에 있을 때 raw 좌표에서 cursor offset만 빼서 반환한다', () => {
        const event = makeEvent(300, 200);
        const result = computeTooltipPos(event, makeRect());
        expect(result.x).toBe(300);
        expect(result.y).toBe(200 - TOOLTIP_CURSOR_OFFSET_Y_PX);
    });

    it('좌측 경계를 넘으면 x를 최소 안쪽 위치로 클램핑한다', () => {
        const event = makeEvent(5, 200);
        const result = computeTooltipPos(event, makeRect());
        expect(result.x).toBe(leftClampThreshold);
    });

    it('우측 경계를 넘으면 x를 최대 안쪽 위치로 클램핑한다', () => {
        const event = makeEvent(CONTAINER_WIDTH - 5, 200);
        const result = computeTooltipPos(event, makeRect());
        expect(result.x).toBe(rightClampThreshold);
    });

    it('상단 경계를 넘으면 y를 추정 카드 높이만큼 아래로 클램핑한다', () => {
        const event = makeEvent(300, 10);
        const result = computeTooltipPos(event, makeRect());
        expect(result.y).toBe(topClampMinAnchorY - TOOLTIP_CURSOR_OFFSET_Y_PX);
    });

    it('container가 viewport 안쪽으로 오프셋된 경우에도 container 기준 상대 좌표를 반환한다', () => {
        // container가 viewport에서 (100, 50) 오프셋된 상황을 가정. cursor가
        // viewport 기준 (400, 250)에 있으면 container 기준 (300, 200)이다.
        const offsetRect = {
            left: 100,
            top: 50,
            width: CONTAINER_WIDTH,
            height: CONTAINER_HEIGHT,
        } as DOMRect;
        const event = makeEvent(400, 250);
        const result = computeTooltipPos(event, offsetRect);
        expect(result.x).toBe(300);
        expect(result.y).toBe(200 - TOOLTIP_CURSOR_OFFSET_Y_PX);
    });
});
