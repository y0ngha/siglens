// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useElderRayChart } from '../../hooks/useElderRayChart';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    HistogramSeries: 'HistogramSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useElderRayChart
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { elderRay: [] } as unknown as IndicatorResult;
const FILLED_INDICATORS = {
    elderRay: [{ bullPower: 2, bearPower: -1 }],
} as unknown as IndicatorResult;
const FAKE_BARS: Bar[] = [
    { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
];

describe('useElderRayChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two histogram series when visible', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when not visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(props => useElderRayChart(props), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: false,
            paneIndex: 1,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).toHaveBeenCalledTimes(2);
    });

    it('does not set data when elderRay is empty', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('recreates series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(props => useElderRayChart(props), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: true,
            paneIndex: 2,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });
});
