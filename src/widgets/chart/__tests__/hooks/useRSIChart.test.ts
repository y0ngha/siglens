// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useRSIChart } from '../../hooks/useRSIChart';
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
    return { current: chart } as Parameters<typeof useRSIChart>[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { rsi: [] } as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    rsi: [null, null, 55, 60, 70],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useRSIChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns void', () => {
        const { result } = renderHook(() =>
            useRSIChart({
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
            useRSIChart({
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
            useRSIChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: false,
                paneIndex: INACTIVE_PANE_INDEX,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates RSI series when visible with chart', () => {
        renderHook(() =>
            useRSIChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockAddSeries).toHaveBeenCalled();
    });

    it('removes series when visibility turns off', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ visible, pane }) =>
                useRSIChart({
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
