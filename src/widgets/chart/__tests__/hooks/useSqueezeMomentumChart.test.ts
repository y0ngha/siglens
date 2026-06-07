// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { useSqueezeMomentumChart } from '../../hooks/useSqueezeMomentumChart';
import {
    buildSeriesData,
    buildZeroLineDots,
} from '../../utils/seriesDataUtils';
import { squeezeStateColor } from '../../utils/histogramColorUtils';

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
    buildZeroLineDots: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useSqueezeMomentumChart
    >[0]['chartRef'];
}
function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { squeezeMomentum: [] } as unknown as IndicatorResult;
const FILLED_INDICATORS = {
    squeezeMomentum: [
        {
            momentum: 3,
            sqzOn: true,
            sqzOff: false,
            noSqz: false,
            increasing: true,
        },
    ],
} as unknown as IndicatorResult;
const FAKE_BARS: Bar[] = [
    { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
];

describe('useSqueezeMomentumChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates histogram + state-dots series when visible', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when not visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useSqueezeMomentumChart(p), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: false,
            paneIndex: 1,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).toHaveBeenCalledTimes(2);
    });

    it('wires momentum colorFn to row.increasing and passes squeezeStateColor for dots', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        // 모멘텀 colorFn은 row.increasing을 squeezeMomentumColor로 forward해야 한다.
        const momentumColorFn = vi
            .mocked(buildSeriesData)
            .mock.calls.find(c => c[2] === 'momentum')?.[3];
        expect(momentumColorFn?.(3, { increasing: true } as never, 0)).toBe(
            CHART_COLORS.squeezeMomentumUp
        );
        expect(momentumColorFn?.(3, { increasing: false } as never, 0)).toBe(
            CHART_COLORS.squeezeMomentumUpWeak
        );
        // 상태 점은 squeezeStateColor 함수 자체를 buildZeroLineDots에 넘긴다.
        expect(vi.mocked(buildZeroLineDots).mock.calls[0][2]).toBe(
            squeezeStateColor
        );
    });

    it('does not set data when squeezeMomentum is empty', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('recreates series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useSqueezeMomentumChart(p), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: true,
            paneIndex: 2,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });
});
