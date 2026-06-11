// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useYangZhangChart } from '../../hooks/useYangZhangChart';
import { INACTIVE_PANE_INDEX } from '../../constants';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockCreatePriceLine = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
    createPriceLine: mockCreatePriceLine,
}));

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
    LineStyle: { Dashed: 1 },
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesDataFromValues: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return {
        current: chart,
    } as Parameters<typeof useYangZhangChart>[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { yangZhang: [] } as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    yangZhang: [0.12, 0.18, 0.15],
} as unknown as IndicatorResult;

const ALL_NULL_INDICATORS = {
    yangZhang: [null, null, null],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useYangZhangChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns void', () => {
        const { result } = renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
                isVisible: false,
                paneIndex: INACTIVE_PANE_INDEX,
            })
        );

        expect(result.current).toBeUndefined();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('does not create series when not visible', () => {
        renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: false,
                paneIndex: INACTIVE_PANE_INDEX,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates Yang-Zhang series without a zero line when visible with chart', () => {
        renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockAddSeries).toHaveBeenCalled();
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('sets data when visible with filled indicators', () => {
        renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockSetData).toHaveBeenCalled();
    });

    it('does not set data when indicator array is empty', () => {
        renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('sets data once when indicator array is all-null (length > 0 passes guard)', () => {
        renderHook(() =>
            useYangZhangChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: ALL_NULL_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockAddSeries).toHaveBeenCalled();
        expect(mockSetData).toHaveBeenCalledTimes(1);
    });

    it('recreates series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ pane }) =>
                useYangZhangChart({
                    chartRef: makeChartRef(chart),
                    bars: FAKE_BARS,
                    indicators: FILLED_INDICATORS,
                    isVisible: true,
                    paneIndex: pane,
                }),
            { initialProps: { pane: 2 } }
        );

        rerender({ pane: 3 });

        expect(mockRemoveSeries).toHaveBeenCalled();
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes series when visibility turns off', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ visible, pane }) =>
                useYangZhangChart({
                    chartRef: makeChartRef(chart),
                    bars: FAKE_BARS,
                    indicators: FILLED_INDICATORS,
                    isVisible: visible,
                    paneIndex: pane,
                }),
            { initialProps: { visible: true, pane: 2 } }
        );

        rerender({ visible: false, pane: INACTIVE_PANE_INDEX });

        expect(mockRemoveSeries).toHaveBeenCalled();
    });
});
