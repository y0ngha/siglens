// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import type { IndicatorDataAccessor } from '../../hooks/useMovingAverageOverlay';
import { useMovingAverageOverlay } from '../../hooks/useMovingAverageOverlay';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
    LineStyle: { Solid: 0, Dotted: 2 },
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesDataFromValues: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useMovingAverageOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const mockAccessor: IndicatorDataAccessor = vi.fn(
    (indicators: IndicatorResult, period: number) =>
        (indicators.ma as Record<number, (number | null)[]>)[period]
);

const INDICATORS = {
    ma: { 10: [50, 51], 20: [100, 101] },
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

describe('useMovingAverageOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty visiblePeriods by default', () => {
        const { result } = renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        expect(result.current.visiblePeriods).toEqual([]);
    });

    it('respects defaultPeriods', () => {
        const { result } = renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                defaultPeriods: [10, 20],
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        expect(result.current.visiblePeriods).toEqual([10, 20]);
    });

    it('togglePeriod adds and removes periods', () => {
        const { result } = renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        act(() => {
            result.current.togglePeriod(10);
        });
        expect(result.current.visiblePeriods).toEqual([10]);

        act(() => {
            result.current.togglePeriod(20);
        });
        expect(result.current.visiblePeriods).toEqual([10, 20]);

        act(() => {
            result.current.togglePeriod(10);
        });
        expect(result.current.visiblePeriods).toEqual([20]);
    });

    it('creates line series for each visible period when chart exists', () => {
        const chart = makeChart();
        renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                defaultPeriods: [10, 20],
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                defaultPeriods: [10],
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('removes series when period is toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                defaultPeriods: [10],
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        act(() => {
            result.current.togglePeriod(10);
        });

        expect(mockRemoveSeries).toHaveBeenCalled();
    });

    it('provides stable togglePeriod reference', () => {
        const { result, rerender } = renderHook(() =>
            useMovingAverageOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                lineStyle: 0,
                getIndicatorData: mockAccessor,
            })
        );

        const firstToggle = result.current.togglePeriod;
        rerender();
        expect(result.current.togglePeriod).toBe(firstToggle);
    });
});
