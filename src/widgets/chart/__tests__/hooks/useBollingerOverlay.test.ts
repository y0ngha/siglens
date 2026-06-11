// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useBollingerOverlay } from '../../hooks/useBollingerOverlay';
import { STORAGE_KEYS } from '../../constants';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    AreaSeries: 'AreaSeries',
    LineSeries: 'LineSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useBollingerOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    bollinger: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    bollinger: [{ upper: 110, middle: 100, lower: 90 }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useBollingerOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );

        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });
        expect(result.current.isVisible).toBe(true);

        act(() => {
            result.current.toggle();
        });
        expect(result.current.isVisible).toBe(false);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates three series (upper, middle, lower) when visible and chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockAddSeries).toHaveBeenCalledTimes(3);
    });

    it('removes series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });
        act(() => {
            result.current.toggle();
        });

        expect(mockRemoveSeries).toHaveBeenCalled();
    });

    it('persists isVisible to localStorage on toggle', () => {
        const { result } = renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => {
            result.current.toggle();
        });
        expect(localStorage.getItem(STORAGE_KEYS.overlay('bollinger'))).toBe(
            'true'
        );
    });

    it('restores isVisible true from localStorage on mount', () => {
        localStorage.setItem(STORAGE_KEYS.overlay('bollinger'), 'true');
        const { result } = renderHook(() =>
            useBollingerOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(true);
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useBollingerOverlay({
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
