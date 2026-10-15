import { describe, expect, it, vi } from 'vitest';
import type { SeriesAttachedParameter, Time } from 'lightweight-charts';
import {
    bandSpan,
    createExtendedSessionPrimitive,
} from '../../utils/extendedSessionPrimitive';
import type { ExtendedSessionRange } from '@/shared/api/market/extendedBarsSession';

describe('bandSpan', () => {
    it('첫 봉 왼쪽 반 칸부터 마지막 봉 오른쪽 반 칸까지', () => {
        expect(bandSpan(100, 160, 10, 400)).toEqual({ x1: 95, x2: 165 });
    });

    it('왼쪽 밖으로 나가면 0에서 자른다', () => {
        expect(bandSpan(-30, 20, 10, 400)).toEqual({ x1: 0, x2: 25 });
    });

    it('오른쪽 밖으로 나가면 pane 폭에서 자른다', () => {
        expect(bandSpan(380, 450, 10, 400)).toEqual({ x1: 375, x2: 400 });
    });

    it.each([
        ['시작 좌표 변환 실패', null, 100],
        ['끝 좌표 변환 실패', 100, null],
        ['전부 왼쪽 밖', -100, -50],
        ['전부 오른쪽 밖', 500, 600],
    ])('그릴 것이 없으면 null — %s', (_label, start, end) => {
        expect(bandSpan(start, end, 10, 400)).toBeNull();
    });
});

describe('createExtendedSessionPrimitive', () => {
    const RANGES: ExtendedSessionRange[] = [
        { session: 'pre', startTime: 100, endTime: 160 },
        { session: 'after', startTime: 400, endTime: 460 },
    ];

    function setup(coordinates: Record<number, number | null>) {
        const timeToCoordinate = vi.fn((t: number) => coordinates[t] ?? null);
        // 논리 인덱스 0·1의 좌표 차 = 봉 간격 10px
        const logicalToCoordinate = vi.fn((l: number) => l * 10);
        const requestUpdate = vi.fn();
        const param = {
            chart: {
                // 가격 차트는 시간축을 숨겨 `width()`가 0이다 — 밴드가 그 값에 기대면 사라진다.
                timeScale: () => ({
                    timeToCoordinate,
                    logicalToCoordinate,
                    width: () => 0,
                }),
            },
            requestUpdate,
        } as unknown as SeriesAttachedParameter<Time>;
        const context = {
            save: vi.fn(),
            restore: vi.fn(),
            fillRect: vi.fn(),
            fillStyle: '',
        };
        const target = {
            useMediaCoordinateSpace: (
                cb: (scope: {
                    context: typeof context;
                    mediaSize: { width: number; height: number };
                }) => void
            ) => cb({ context, mediaSize: { width: 400, height: 200 } }),
        };
        const primitive = createExtendedSessionPrimitive('#band');
        const draw = () =>
            primitive
                .paneViews?.()[0]
                ?.renderer()
                ?.draw(target as never);
        return {
            primitive,
            param,
            context,
            draw,
            requestUpdate,
            timeToCoordinate,
        };
    }

    it('캔들 뒤(bottom)에 그리는 pane view를 낸다', () => {
        const { primitive } = setup({});
        expect(primitive.paneViews?.()[0]?.zOrder?.()).toBe('bottom');
    });

    it('구간마다 첫·마지막 봉 좌표로 pane 전체 높이의 밴드를 칠한다', () => {
        const { primitive, param, context, draw } = setup({
            100: 50,
            160: 110,
            400: 300,
            460: 380,
        });
        primitive.attached?.(param);
        primitive.setRanges(RANGES);
        draw();

        expect(context.fillStyle).toBe('#band');
        expect(context.fillRect).toHaveBeenCalledTimes(2);
        // 첫 구간: 50-5 ~ 110+5, 두 번째: 300-5 ~ 380+5
        // 첫 구간: 50-5 ~ 110+5, 두 번째: 300-5 ~ 380+5
        expect(context.fillRect).toHaveBeenCalledWith(45, 0, 70, 200);
        expect(context.fillRect).toHaveBeenCalledWith(295, 0, 90, 200);
    });

    it('시간축 폭(timeScale().width())이 0이어도 그릴 때의 pane 폭으로 칠한다(가격 차트는 시간축을 숨긴다)', () => {
        const { primitive, param, context, draw } = setup({
            100: 50,
            160: 110,
        });
        primitive.attached?.(param);
        primitive.setRanges([RANGES[0]!]);
        draw();
        expect(context.fillRect).toHaveBeenCalledTimes(1);
    });

    it('시각 좌표를 구하지 못한 구간은 건너뛴다', () => {
        const { primitive, param, context, draw } = setup({
            400: 300,
            460: 380,
        });
        primitive.attached?.(param);
        primitive.setRanges(RANGES);
        draw();
        expect(context.fillRect).toHaveBeenCalledTimes(1);
    });

    it('줌·스크롤로 좌표가 바뀌면 updateAllViews에서 다시 구한다', () => {
        const { primitive, param, draw, timeToCoordinate } = setup({
            100: 50,
            160: 110,
        });
        primitive.attached?.(param);
        primitive.setRanges([RANGES[0]!]);
        timeToCoordinate.mockClear();
        primitive.updateAllViews?.();
        draw();
        expect(timeToCoordinate).toHaveBeenCalledWith(100);
        expect(timeToCoordinate).toHaveBeenCalledWith(160);
    });

    it('구간을 바꾸면 차트에 다시 그리라고 요청한다', () => {
        const { primitive, param, requestUpdate } = setup({});
        primitive.attached?.(param);
        primitive.setRanges(RANGES);
        expect(requestUpdate).toHaveBeenCalled();
    });

    it('detached 뒤에는 아무것도 그리지 않고 좌표도 묻지 않는다', () => {
        const { primitive, param, context, draw, timeToCoordinate } = setup({
            100: 50,
            160: 110,
        });
        primitive.attached?.(param);
        primitive.setRanges([RANGES[0]!]);
        primitive.detached?.();
        timeToCoordinate.mockClear();
        primitive.updateAllViews?.();
        draw();
        expect(timeToCoordinate).not.toHaveBeenCalled();
        expect(context.fillRect).not.toHaveBeenCalled();
    });
});
