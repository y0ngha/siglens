// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useEMAOverlay } from '../../hooks/useEMAOverlay';
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
    LineStyle: { Dotted: 2, Solid: 0 },
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesDataFromValues: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useEMAOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const INDICATORS = {
    ema: { 20: [100, 101], 50: [98, 99] },
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useEMAOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns empty visiblePeriods by default', () => {
        const { result } = renderHook(() =>
            useEMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
            })
        );

        expect(result.current.visiblePeriods).toEqual([]);
    });

    it('returns default periods when provided', () => {
        const { result } = renderHook(() =>
            useEMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                defaultPeriods: [20, 50],
            })
        );

        expect(result.current.visiblePeriods).toEqual([20, 50]);
    });

    it('toggles a period on and off', () => {
        const { result } = renderHook(() =>
            useEMAOverlay({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
            })
        );

        act(() => {
            result.current.togglePeriod(20);
        });
        expect(result.current.visiblePeriods).toContain(20);

        act(() => {
            result.current.togglePeriod(20);
        });
        expect(result.current.visiblePeriods).not.toContain(20);
    });

    it('creates series for visible periods when chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useEMAOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
            })
        );

        act(() => {
            result.current.togglePeriod(20);
        });

        expect(mockAddSeries).toHaveBeenCalled();
    });

    it('removes series when period toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useEMAOverlay({
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

    it('restores visiblePeriods from localStorage (STORAGE_KEYS.emaPeriods)', () => {
        localStorage.setItem(STORAGE_KEYS.emaPeriods, JSON.stringify([20]));
        const { result } = renderHook(() =>
            useEMAOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
            })
        );
        expect(result.current.visiblePeriods).toEqual([20]);
    });
});
