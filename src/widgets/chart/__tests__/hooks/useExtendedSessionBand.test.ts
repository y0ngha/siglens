// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useExtendedSessionBand } from '../../hooks/useExtendedSessionBand';
import type { ExtendedSessionRange } from '@/shared/api/market/extendedBarsSession';

const ranges = (...starts: number[]): ExtendedSessionRange[] =>
    starts.map(t => ({ session: 'pre', startTime: t, endTime: t + 60 }));

function fakeSeries() {
    return {
        attachPrimitive: vi.fn(),
        detachPrimitive: vi.fn(),
    };
}
const asRef = (series: ReturnType<typeof fakeSeries> | null) =>
    ({ current: series }) as never;

describe('useExtendedSessionBand', () => {
    it('구간이 없으면 primitive를 붙이지 않는다', () => {
        const series = fakeSeries();
        renderHook(() => useExtendedSessionBand(asRef(series), []));
        expect(series.attachPrimitive).not.toHaveBeenCalled();
    });

    it('시리즈가 아직 없으면(ref null) 붙이지 않고 던지지 않는다', () => {
        expect(() =>
            renderHook(() => useExtendedSessionBand(asRef(null), ranges(1)))
        ).not.toThrow();
    });

    it('구간이 있으면 구간을 채운 primitive를 한 번 붙인다', () => {
        const series = fakeSeries();
        renderHook(() => useExtendedSessionBand(asRef(series), ranges(1, 2)));
        expect(series.attachPrimitive).toHaveBeenCalledTimes(1);
        const primitive = series.attachPrimitive.mock.calls[0]![0];
        expect(typeof primitive.setRanges).toBe('function');
        expect(primitive.paneViews()[0].zOrder()).toBe('bottom');
    });

    it('구간이 바뀌면 이전 primitive를 떼고 새로 붙인다(detach → attach)', () => {
        const series = fakeSeries();
        const { rerender } = renderHook(
            ({ r }: { r: ExtendedSessionRange[] }) =>
                useExtendedSessionBand(asRef(series), r),
            { initialProps: { r: ranges(1) } }
        );
        const first = series.attachPrimitive.mock.calls.find(() => true)![0];
        rerender({ r: ranges(1, 2) });

        expect(series.detachPrimitive).toHaveBeenCalledWith(first);
        expect(series.attachPrimitive).toHaveBeenCalledTimes(2);
        const detachOrder = series.detachPrimitive.mock.invocationCallOrder[0]!;
        const secondAttachOrder =
            series.attachPrimitive.mock.invocationCallOrder[1]!;
        expect(detachOrder).toBeLessThan(secondAttachOrder);
    });

    it('구간이 비면 붙어 있던 primitive를 떼고 새로 붙이지 않는다', () => {
        const series = fakeSeries();
        const { rerender } = renderHook(
            ({ r }: { r: ExtendedSessionRange[] }) =>
                useExtendedSessionBand(asRef(series), r),
            { initialProps: { r: ranges(1) } }
        );
        rerender({ r: [] });
        expect(series.detachPrimitive).toHaveBeenCalledTimes(1);
        expect(series.attachPrimitive).toHaveBeenCalledTimes(1);
    });

    it('언마운트하면 primitive를 뗀다', () => {
        const series = fakeSeries();
        const { unmount } = renderHook(() =>
            useExtendedSessionBand(asRef(series), ranges(1))
        );
        unmount();
        expect(series.detachPrimitive).toHaveBeenCalledTimes(1);
    });

    it('차트가 먼저 제거돼 detach가 던져도 정리에서 삼킨다', () => {
        const series = fakeSeries();
        series.detachPrimitive.mockImplementation(() => {
            throw new Error('Object is disposed');
        });
        const { unmount } = renderHook(() =>
            useExtendedSessionBand(asRef(series), ranges(1))
        );
        expect(() => unmount()).not.toThrow();
        expect(series.detachPrimitive).toHaveBeenCalledTimes(1);
    });
});
