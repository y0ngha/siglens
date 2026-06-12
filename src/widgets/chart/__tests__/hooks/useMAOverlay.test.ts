// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useMAOverlay } from '../../hooks/useMAOverlay';
import { STORAGE_KEYS } from '../../constants';

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
    return { current: chart } as Parameters<typeof useMAOverlay>[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const INDICATORS = {
    ma: { 20: [100, 101, 102], 50: [98, 99, 100] },
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useMAOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns empty visiblePeriods by default', () => {
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
            })
        );

        expect(result.current.visiblePeriods).toEqual([]);
    });

    it('returns provided default periods', () => {
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                defaultPeriods: [20],
            })
        );

        expect(result.current.visiblePeriods).toEqual([20]);
    });

    it('toggles a period', () => {
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
            })
        );

        act(() => {
            result.current.togglePeriod(50);
        });
        expect(result.current.visiblePeriods).toContain(50);

        act(() => {
            result.current.togglePeriod(50);
        });
        expect(result.current.visiblePeriods).not.toContain(50);
    });

    it('creates series for each visible period', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
            })
        );

        act(() => {
            result.current.togglePeriod(20);
        });
        act(() => {
            result.current.togglePeriod(50);
        });

        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes series when period toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
            })
        );

        act(() => {
            result.current.togglePeriod(20);
        });
        act(() => {
            result.current.togglePeriod(20);
        });

        expect(mockRemoveSeries).toHaveBeenCalled();
    });

    it('restores visiblePeriods from localStorage (STORAGE_KEYS.maPeriods)', () => {
        localStorage.setItem(STORAGE_KEYS.maPeriods, JSON.stringify([20]));
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
            })
        );
        expect(result.current.visiblePeriods).toEqual([20]);
    });

    it('persists visiblePeriods to localStorage on toggle', () => {
        const { result } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
            })
        );
        act(() => {
            result.current.togglePeriod(20);
        });
        expect(
            JSON.parse(localStorage.getItem(STORAGE_KEYS.maPeriods) ?? '[]')
        ).toEqual([20]);
    });

    it('provides stable togglePeriod reference', () => {
        const { result, rerender } = renderHook(() =>
            useMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
            })
        );

        const firstToggle = result.current.togglePeriod;
        rerender();
        expect(result.current.togglePeriod).toBe(firstToggle);
    });
});
