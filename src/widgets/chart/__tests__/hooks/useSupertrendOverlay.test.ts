// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useSupertrendOverlay } from '../../hooks/useSupertrendOverlay';

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
        typeof useSupertrendOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    supertrend: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    supertrend: [{ supertrend: 10, trend: 'up' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useSupertrendOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
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
            useSupertrendOverlay({
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
            useSupertrendOverlay({
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
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).toHaveBeenCalledTimes(2);
    });

    it('does not set data when supertrend is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
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
            useSupertrendOverlay({
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
