// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useMACDChart } from '../../hooks/useMACDChart';
import { INACTIVE_PANE_INDEX } from '../../constants';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    HistogramSeries: 'HistogramSeries',
    LineSeries: 'LineSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<typeof useMACDChart>[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { macd: [] } as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    macd: [{ macdLine: 1.5, signalLine: 1.2, histogram: 0.3 }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useMACDChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns void', () => {
        const { result } = renderHook(() =>
            useMACDChart({
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
            useMACDChart({
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
            useMACDChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: false,
                paneIndex: INACTIVE_PANE_INDEX,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates three series (macdLine, signalLine, histogram) when visible', () => {
        renderHook(() =>
            useMACDChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockAddSeries).toHaveBeenCalledTimes(3);
    });

    it('removes series when visibility turns off', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ visible, pane }) =>
                useMACDChart({
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
