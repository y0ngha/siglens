// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useRegressionChart } from '../../hooks/useRegressionChart';
import { buildSeriesData } from '../../utils/seriesDataUtils';
import { regressionBarColor } from '../../utils/histogramColorUtils';

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
        typeof useRegressionChart
    >[0]['chartRef'];
}
function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { regression: [] } as unknown as IndicatorResult;
const FILLED_INDICATORS = {
    regression: [{ slope: 0.4, r2: 0.8 }],
} as unknown as IndicatorResult;
const FAKE_BARS: Bar[] = [
    { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
];

describe('useRegressionChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates one histogram series when visible', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(1);
    });

    it('removes the series when not visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useRegressionChart(p), {
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
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });

    it('sets data when visible with data', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).toHaveBeenCalledTimes(1);
    });

    it('wires the slope colorFn to regressionBarColor(value, row.r2)', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        const colorFn = vi
            .mocked(buildSeriesData)
            .mock.calls.find(c => c[2] === 'slope')?.[3];
        expect(colorFn?.(0.4, { r2: 0.8 } as never, 0)).toBe(
            regressionBarColor(0.4, 0.8)
        );
        expect(colorFn?.(-0.4, { r2: null } as never, 0)).toBe(
            regressionBarColor(-0.4, null)
        );
    });

    it('does not set data when regression is empty', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('recreates the series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useRegressionChart(p), {
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
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });
});
