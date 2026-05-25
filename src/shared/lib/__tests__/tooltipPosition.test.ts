import {
    getTooltipPosition,
    TOOLTIP_GAP,
    TOOLTIP_VIEWPORT_PADDING,
} from '@/shared/lib/tooltipPosition';

function makeDOMRect(
    x: number,
    y: number,
    width: number,
    height: number
): DOMRect {
    return {
        x,
        y,
        width,
        height,
        top: y,
        left: x,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
    };
}

describe('tooltipPosition constants', () => {
    it('TOOLTIP_VIEWPORT_PADDING is 8', () => {
        expect(TOOLTIP_VIEWPORT_PADDING).toBe(8);
    });

    it('TOOLTIP_GAP is 6', () => {
        expect(TOOLTIP_GAP).toBe(6);
    });
});

describe('getTooltipPosition', () => {
    const viewportWidth = 1024;

    describe('vertical positioning', () => {
        it('places tooltip above trigger when there is enough space', () => {
            const triggerRect = makeDOMRect(400, 200, 100, 30);
            const tooltipRect = makeDOMRect(0, 0, 120, 40);

            const { top } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            // aboveTop = 200 - 40 - 6 = 154, which is >= 8 (padding)
            expect(top).toBe(
                triggerRect.top - tooltipRect.height - TOOLTIP_GAP
            );
        });

        it('places tooltip below trigger when above space is insufficient', () => {
            const triggerRect = makeDOMRect(400, 10, 100, 30);
            const tooltipRect = makeDOMRect(0, 0, 120, 40);

            const { top } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            // aboveTop = 10 - 40 - 6 = -36, which is < 8 (padding)
            expect(top).toBe(triggerRect.bottom + TOOLTIP_GAP);
        });

        it('falls back to below when trigger is at very top (aboveTop exactly at padding)', () => {
            // aboveTop = TOOLTIP_VIEWPORT_PADDING means it should still go above
            const tooltipHeight = 40;
            const triggerTop =
                TOOLTIP_VIEWPORT_PADDING + tooltipHeight + TOOLTIP_GAP;
            const triggerRect = makeDOMRect(400, triggerTop, 100, 30);
            const tooltipRect = makeDOMRect(0, 0, 120, tooltipHeight);

            const { top } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            expect(top).toBe(TOOLTIP_VIEWPORT_PADDING);
        });

        it('goes below when aboveTop is just under the padding threshold', () => {
            const tooltipHeight = 40;
            // Make aboveTop = TOOLTIP_VIEWPORT_PADDING - 1
            const triggerTop =
                TOOLTIP_VIEWPORT_PADDING + tooltipHeight + TOOLTIP_GAP - 1;
            const triggerRect = makeDOMRect(400, triggerTop, 100, 30);
            const tooltipRect = makeDOMRect(0, 0, 120, tooltipHeight);

            const { top } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            expect(top).toBe(triggerRect.bottom + TOOLTIP_GAP);
        });
    });

    describe('horizontal positioning', () => {
        it('centers tooltip horizontally on the trigger', () => {
            const triggerRect = makeDOMRect(400, 200, 100, 30);
            const tooltipRect = makeDOMRect(0, 0, 120, 40);

            const { left } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            // rawLeft = 400 + 50 - 60 = 390
            // maxLeft = 1024 - 120 - 8 = 896
            // left = max(8, min(390, 896)) = 390
            expect(left).toBe(390);
        });

        it('clamps to left edge padding when trigger is near left viewport edge', () => {
            const triggerRect = makeDOMRect(0, 200, 10, 30);
            const tooltipRect = makeDOMRect(0, 0, 120, 40);

            const { left } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            // rawLeft = 0 + 5 - 60 = -55
            // left = max(8, min(-55, ...)) = 8
            expect(left).toBe(TOOLTIP_VIEWPORT_PADDING);
        });

        it('clamps to right edge when trigger is near right viewport edge', () => {
            const triggerRect = makeDOMRect(990, 200, 30, 30);
            const tooltipRect = makeDOMRect(0, 0, 200, 40);

            const { left } = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            // rawLeft = 990 + 15 - 100 = 905
            // maxLeft = 1024 - 200 - 8 = 816
            // left = max(8, min(905, 816)) = 816
            expect(left).toBe(
                viewportWidth - tooltipRect.width - TOOLTIP_VIEWPORT_PADDING
            );
        });
    });

    describe('return value shape', () => {
        it('returns an object with top and left properties', () => {
            const triggerRect = makeDOMRect(100, 100, 50, 20);
            const tooltipRect = makeDOMRect(0, 0, 80, 30);

            const result = getTooltipPosition(
                triggerRect,
                tooltipRect,
                viewportWidth
            );

            expect(result).toHaveProperty('top');
            expect(result).toHaveProperty('left');
            expect(typeof result.top).toBe('number');
            expect(typeof result.left).toBe('number');
        });
    });
});
