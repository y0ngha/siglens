// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { LineStyle, LineType } from 'lightweight-charts';
import { useDonchianOverlay } from '../../hooks/useDonchianOverlay';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(
    (_definition: unknown, _options: Record<string, unknown>) => ({
        setData: mockSetData,
        applyOptions: mockApplyOptions,
    })
);

vi.mock('lightweight-charts', () => ({
    AreaSeries: 'AreaSeries',
    LineSeries: 'LineSeries',
    // Donchian renders as stepped lines (middle dashed). Mirror the real
    // enum values so option assertions match production behavior.
    LineType: { Simple: 0, WithSteps: 1, Curved: 2 },
    LineStyle: {
        Solid: 0,
        Dotted: 1,
        Dashed: 2,
        LargeDashed: 3,
        SparseDotted: 4,
    },
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useDonchianOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    donchianChannel: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    donchianChannel: [{ upper: 21, middle: 20, lower: 19 }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useDonchianOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useDonchianOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );

        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useDonchianOverlay({
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
            useDonchianOverlay({
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
            useDonchianOverlay({
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
            useDonchianOverlay({
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

        expect(mockRemoveSeries).toHaveBeenCalledTimes(3);
    });

    it('sets data on three series when visible with data', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useDonchianOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockSetData).toHaveBeenCalledTimes(3);
    });

    it('does not set data when donchianChannel is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useDonchianOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('creates all three series as stepped lines', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useDonchianOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockAddSeries).toHaveBeenCalledTimes(3);
        for (const call of mockAddSeries.mock.calls) {
            expect(call[1]).toEqual(
                expect.objectContaining({ lineType: LineType.WithSteps })
            );
        }
    });

    it('renders the middle line as a dashed stepped line', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useDonchianOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockAddSeries).toHaveBeenCalledWith(
            'LineSeries',
            expect.objectContaining({
                lineType: LineType.WithSteps,
                lineStyle: LineStyle.Dashed,
            })
        );
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useDonchianOverlay({
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
