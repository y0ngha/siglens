// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useMACDChart } from '../../hooks/useMACDChart';
import { INACTIVE_PANE_INDEX } from '../../constants';
import { buildSeriesData } from '../../utils/seriesDataUtils';
import { CHART_COLORS } from '@/shared/lib/chartColors';

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

    it('recreates all three series when paneIndex changes while visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ pane }) =>
                useMACDChart({
                    chartRef: makeChartRef(chart),
                    bars: FAKE_BARS,
                    indicators: FILLED_INDICATORS,
                    isVisible: true,
                    paneIndex: pane,
                }),
            { initialProps: { pane: 2 } }
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(3);
        mockAddSeries.mockClear();
        mockRemoveSeries.mockClear();

        // 사용자가 다른 지표를 켜/꺼서 pane 배치가 바뀐 상황을 재현 — 기존
        // pane의 시리즈 3개를 지우고 새 pane에 다시 그려야 한다.
        rerender({ pane: 3 });

        expect(mockRemoveSeries).toHaveBeenCalledTimes(3);
        expect(mockAddSeries).toHaveBeenCalledTimes(3);
    });

    it('does not recreate series when paneIndex is unchanged', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ pane }) =>
                useMACDChart({
                    chartRef: makeChartRef(chart),
                    bars: FAKE_BARS,
                    indicators: FILLED_INDICATORS,
                    isVisible: true,
                    paneIndex: pane,
                }),
            { initialProps: { pane: 2 } }
        );
        mockAddSeries.mockClear();
        mockRemoveSeries.mockClear();

        rerender({ pane: 2 });

        expect(mockRemoveSeries).not.toHaveBeenCalled();
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    /**
     * 히스토그램 막대 색을 값 부호로 나눈다 — 양(+)은 상승색, 음(-)/0은 하락색.
     * `buildSeriesData`에 넘긴 컬러 리졸버 콜백 자체를 실행해 두 분기를 확인한다.
     */
    it('colors the histogram bar by the sign of its value', () => {
        renderHook(() =>
            useMACDChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 2,
            })
        );

        const colorResolver = vi
            .mocked(buildSeriesData)
            .mock.calls.find(call => call[2] === 'histogram')?.[3] as (
            value: number
        ) => string;

        expect(colorResolver(0.5)).toBe(CHART_COLORS.macdHistogramBullish);
        expect(colorResolver(-0.5)).toBe(CHART_COLORS.macdHistogramBearish);
        expect(colorResolver(0)).toBe(CHART_COLORS.macdHistogramBullish);
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
