// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useStochRSIChart } from '../../hooks/useStochRSIChart';
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
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useStochRSIChart
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { stochRsi: [] } as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    stochRsi: [{ k: 0.8, d: 0.75 }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useStochRSIChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns void', () => {
        const { result } = renderHook(() =>
            useStochRSIChart({
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
            useStochRSIChart({
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
            useStochRSIChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: false,
                paneIndex: INACTIVE_PANE_INDEX,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two series (K and D) when visible', () => {
        renderHook(() =>
            useStochRSIChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes series when visibility turns off', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ visible, pane }) =>
                useStochRSIChart({
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
