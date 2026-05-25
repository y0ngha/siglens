// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useIchimokuOverlay } from '../../hooks/useIchimokuOverlay';

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
    LineStyle: { Dashed: 1 },
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    calculateIchimokuFutureCloud: vi.fn(() => []),
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

vi.mock('../../utils/ichimokuUtils', () => ({
    buildCloudData: vi.fn(() => []),
    extendWithFutureCloud: vi.fn((_bars, _cloud, base) => ({
        finalSenkouA: base.senkouAData,
        finalSenkouB: base.senkouBData,
        finalCloudBullish: base.cloudBullishData,
        finalCloudBearish: base.cloudBearishData,
    })),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useIchimokuOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { ichimoku: [] } as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    ichimoku: [
        {
            tenkan: 100,
            kijun: 99,
            chikou: 98,
            senkouA: 101,
            senkouB: 97,
        },
    ],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

describe('useIchimokuOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useIchimokuOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );

        expect(result.current.isVisible).toBe(false);
    });

    it('toggles visibility', () => {
        const { result } = renderHook(() =>
            useIchimokuOverlay({
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
            useIchimokuOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates seven series when visible (5 lines + 2 cloud areas)', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useIchimokuOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockAddSeries).toHaveBeenCalledTimes(7);
    });

    it('removes series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useIchimokuOverlay({
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

    it('provides stable toggle reference', () => {
        const { result, rerender } = renderHook(() =>
            useIchimokuOverlay({
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
