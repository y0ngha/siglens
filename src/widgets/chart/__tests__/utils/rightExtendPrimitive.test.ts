import { describe, expect, it, vi } from 'vitest';
import { LineStyle } from 'lightweight-charts';
import type { SeriesAttachedParameter, Time } from 'lightweight-charts';
import {
    createRightExtendPrimitive,
    rightExtendSegment,
} from '../../utils/rightExtendPrimitive';

describe('rightExtendSegment', () => {
    it('마지막 봉 x부터 pane 오른쪽 끝까지', () => {
        expect(rightExtendSegment(120, 40, 300)).toEqual({
            x1: 120,
            x2: 300,
            y: 40,
        });
    });

    it('x가 왼쪽 밖이면 0부터', () => {
        expect(rightExtendSegment(-15, 40, 300)).toEqual({
            x1: 0,
            x2: 300,
            y: 40,
        });
    });

    it.each([
        [null, 40, 300],
        [120, null, 300],
        [300, 40, 300],
        [350, 40, 300],
    ])('그릴 구간이 없으면 null: x=%s y=%s w=%s', (x, y, w) => {
        expect(rightExtendSegment(x, y, w)).toBeNull();
    });
});

describe('createRightExtendPrimitive', () => {
    const OPTS = {
        startTime: 100 as Time,
        price: 50,
        color: '#123456',
        lineWidth: 2,
        dashed: true,
    };

    function setup(x: number | null, y: number | null) {
        const timeToCoordinate = vi.fn(() => x);
        const priceToCoordinate = vi.fn(() => y);
        const param = {
            chart: { timeScale: () => ({ timeToCoordinate }) },
            series: { priceToCoordinate },
        } as unknown as SeriesAttachedParameter<Time>;
        const context = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            strokeStyle: '',
            lineWidth: 0,
        };
        const target = {
            useMediaCoordinateSpace: (
                cb: (scope: {
                    context: typeof context;
                    mediaSize: { width: number; height: number };
                }) => void
            ) => cb({ context, mediaSize: { width: 300, height: 200 } }),
        };
        const utils = { setLineStyle: vi.fn() };
        const primitive = createRightExtendPrimitive(OPTS);
        const draw = () =>
            primitive
                .paneViews?.()[0]
                ?.renderer()
                ?.draw(target as never, utils as never);
        return {
            primitive,
            param,
            context,
            utils,
            draw,
            timeToCoordinate,
            priceToCoordinate,
        };
    }

    it('updateAllViews로 좌표를 구해 마지막 봉 x부터 오른쪽 끝까지 그린다', () => {
        const { primitive, param, context, utils, draw, timeToCoordinate } =
            setup(120, 40);
        primitive.attached?.(param);
        primitive.updateAllViews?.();
        draw();
        expect(timeToCoordinate).toHaveBeenCalledWith(100);
        expect(context.strokeStyle).toBe('#123456');
        expect(context.lineWidth).toBe(2);
        expect(utils.setLineStyle).toHaveBeenCalledWith(
            context,
            LineStyle.Dashed
        );
        expect(context.moveTo).toHaveBeenCalledWith(120, 40);
        expect(context.lineTo).toHaveBeenCalledWith(300, 40);
    });

    it('좌표가 null이면 그리지 않는다', () => {
        const { primitive, param, context, draw } = setup(null, 40);
        primitive.attached?.(param);
        primitive.updateAllViews?.();
        draw();
        expect(context.stroke).not.toHaveBeenCalled();
    });

    it('detached 뒤 updateAllViews는 좌표를 다시 묻지 않는다', () => {
        const { primitive, param, timeToCoordinate } = setup(120, 40);
        primitive.attached?.(param);
        primitive.detached?.();
        primitive.updateAllViews?.();
        expect(timeToCoordinate).not.toHaveBeenCalled();
    });
});
