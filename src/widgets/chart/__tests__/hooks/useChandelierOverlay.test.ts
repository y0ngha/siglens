// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useChandelierOverlay } from '../../hooks/useChandelierOverlay';
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
    LineStyle: { Dashed: 2 },
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildTrendSplitData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useChandelierOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    chandelierExit: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    chandelierExit: [{ longStop: 90, shortStop: 110, trend: 'long' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useChandelierOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useChandelierOverlay({
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
            useChandelierOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two LineSeries (long, short) when visible and chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
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
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data with long/short direction and longStop/shortStop selectors', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
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
            FILLED_INDICATORS.chandelierExit,
            'long',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.chandelierExit,
            'short',
            expect.any(Function)
        );
    });

    it('long selector reads longStop, short selector reads shortStop', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        const calls = vi.mocked(buildTrendSplitData).mock.calls;
        const longCall = calls.find(c => c[2] === 'long');
        const shortCall = calls.find(c => c[2] === 'short');
        const row = { longStop: 90, shortStop: 110, trend: 'long' as const };
        expect(longCall?.[3](row)).toBe(90);
        expect(shortCall?.[3](row)).toBe(110);
    });

    it('re-sets data on both series when bars change while visible', () => {
        const chart = makeChart();
        const { result, rerender } = renderHook(
            ({ bars }) =>
                useChandelierOverlay({
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
            FILLED_INDICATORS.chandelierExit,
            'long',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            newBars,
            FILLED_INDICATORS.chandelierExit,
            'short',
            expect.any(Function)
        );
    });

    it('does not set data when chandelierExit is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useChandelierOverlay({
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
