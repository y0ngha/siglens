// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useParabolicSarOverlay } from '../../hooks/useParabolicSarOverlay';
import { STORAGE_KEYS } from '../../constants';
import { buildTrendSplitData } from '../../utils/seriesDataUtils';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildTrendSplitData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useParabolicSarOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    parabolicSar: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    parabolicSar: [{ sar: 99, trend: 'up' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useParabolicSarOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(true);
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(false);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two LineSeries (up, down) when visible and chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series with up/down direction and sar selector', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).toHaveBeenCalledTimes(2);
        const splitMock = vi.mocked(buildTrendSplitData);
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.parabolicSar,
            'up',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.parabolicSar,
            'down',
            expect.any(Function)
        );
    });

    it('both up and down selectors read r.sar', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        const calls = vi.mocked(buildTrendSplitData).mock.calls;
        const upCall = calls.find(c => c[2] === 'up');
        const downCall = calls.find(c => c[2] === 'down');
        const row = { sar: 99, trend: 'up' as const };
        expect(upCall?.[3](row)).toBe(99);
        expect(downCall?.[3](row)).toBe(99);
    });

    it('re-sets data on both series when bars change while visible', () => {
        const chart = makeChart();
        const { result, rerender } = renderHook(
            ({ bars }) =>
                useParabolicSarOverlay({
                    chartRef: makeChartRef(chart),
                    bars,
                    indicators: FILLED_INDICATORS,
                }),
            { initialProps: { bars: FAKE_BARS } }
        );
        act(() => result.current.toggle());
        vi.clearAllMocks();

        const newBars: Bar[] = [
            {
                time: 2000,
                open: 200,
                high: 220,
                low: 180,
                close: 210,
                volume: 2000,
            },
        ];
        rerender({ bars: newBars });

        expect(mockSetData).toHaveBeenCalledTimes(2);
        const splitMock = vi.mocked(buildTrendSplitData);
        expect(splitMock).toHaveBeenCalledWith(
            newBars,
            FILLED_INDICATORS.parabolicSar,
            'up',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            newBars,
            FILLED_INDICATORS.parabolicSar,
            'down',
            expect.any(Function)
        );
    });

    it('does not set data when parabolicSar is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('restores isVisible true from localStorage on mount', () => {
        localStorage.setItem(STORAGE_KEYS.overlay('parabolicSar'), 'true');
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(true);
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        const firstToggle = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(firstToggle);
    });
});
