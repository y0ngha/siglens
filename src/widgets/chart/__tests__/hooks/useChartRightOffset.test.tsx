import { act, renderHook } from '@testing-library/react';
import type { IChartApi } from 'lightweight-charts';
import { useChartRightOffset } from '../../hooks/useChartRightOffset';

describe('useChartRightOffset', () => {
    const fakeChart = () => {
        const applyOptions = vi.fn();
        return {
            chart: { applyOptions } as unknown as IChartApi,
            applyOptions,
        };
    };

    it('차트가 준비되기 전에 온 여백을 준비되는 순간 적용한다', () => {
        const { result } = renderHook(() => useChartRightOffset());
        const { chart, applyOptions } = fakeChart();
        act(() => result.current.onRightGutterChange(48));
        act(() => result.current.onChartReady(chart));
        expect(applyOptions).toHaveBeenLastCalledWith({
            timeScale: { rightOffsetPixels: 48 },
        });
    });

    it('준비된 뒤 바뀐 여백은 바로 적용한다', () => {
        const { result } = renderHook(() => useChartRightOffset());
        const { chart, applyOptions } = fakeChart();
        act(() => result.current.onChartReady(chart));
        act(() => result.current.onRightGutterChange(64));
        expect(applyOptions).toHaveBeenLastCalledWith({
            timeScale: { rightOffsetPixels: 64 },
        });
    });

    it('차트가 사라진 뒤의 여백은 옛 차트에 적용하지 않는다', () => {
        const { result } = renderHook(() => useChartRightOffset());
        const { chart, applyOptions } = fakeChart();
        act(() => result.current.onChartReady(chart));
        act(() => result.current.onChartRemove());
        applyOptions.mockClear();
        act(() => result.current.onRightGutterChange(30));
        expect(applyOptions).not.toHaveBeenCalled();
    });
});
