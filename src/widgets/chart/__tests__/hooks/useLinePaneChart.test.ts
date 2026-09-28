// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useLinePaneChart } from '../../hooks/useLinePaneChart';
import { INACTIVE_PANE_INDEX } from '../../constants';
import type { LinePaneSpec } from '../../model/linePaneSpecs';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { buildSeriesDataFromValues } from '../../utils/seriesDataUtils';

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
    buildSeriesDataFromValues: vi.fn(() => ['built']),
}));

type Params = Parameters<typeof useLinePaneChart>[0];

function makeChartRef(chart: unknown = null): Params['chartRef'] {
    return { current: chart } as Params['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const SPEC: LinePaneSpec = {
    lineColor: 'cciLine',
    referenceLines: [
        { price: 100, color: 'cciOverbought' },
        { price: -100, color: 'cciOversold' },
    ],
    values: i => i.cci,
};

const FILLED = { cci: [100, 50, -50, null] } as unknown as IndicatorResult;
const EMPTY = { cci: [] } as unknown as IndicatorResult;

const BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

function params(overrides: Partial<Params> = {}): Params {
    return {
        chartRef: makeChartRef(makeChart()),
        bars: BARS,
        indicators: FILLED,
        spec: SPEC,
        lineWidth: 2,
        isVisible: true,
        paneIndex: 3,
        ...overrides,
    };
}

describe('useLinePaneChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does nothing without a chart or while hidden', () => {
        renderHook(() =>
            useLinePaneChart(params({ chartRef: makeChartRef() }))
        );
        renderHook(() =>
            useLinePaneChart(
                params({ isVisible: false, paneIndex: INACTIVE_PANE_INDEX })
            )
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('adds one line series on its pane with the spec colour and options', () => {
        renderHook(() => useLinePaneChart(params()));

        expect(mockAddSeries).toHaveBeenCalledTimes(1);
        expect(mockAddSeries).toHaveBeenCalledWith(
            'LineSeries',
            {
                color: CHART_COLORS.cciLine,
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
            },
            3
        );
    });

    it('draws every reference line dashed, in spec order', () => {
        renderHook(() => useLinePaneChart(params()));

        expect(mockCreatePriceLine.mock.calls.map(([opts]) => opts)).toEqual([
            {
                price: 100,
                color: CHART_COLORS.cciOverbought,
                lineWidth: 2,
                lineStyle: 1,
                axisLabelVisible: false,
                title: '',
            },
            {
                price: -100,
                color: CHART_COLORS.cciOversold,
                lineWidth: 2,
                lineStyle: 1,
                axisLabelVisible: false,
                title: '',
            },
        ]);
    });

    it('sets the values the spec selects', () => {
        renderHook(() => useLinePaneChart(params()));

        expect(buildSeriesDataFromValues).toHaveBeenCalledWith(
            BARS,
            FILLED.cci
        );
        expect(mockSetData).toHaveBeenCalledWith(['built']);
    });

    it('skips setData when the indicator has no values', () => {
        renderHook(() => useLinePaneChart(params({ indicators: EMPTY })));
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('removes the series when it is hidden', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ visible }) =>
                useLinePaneChart(
                    params({
                        chartRef: makeChartRef(chart),
                        isVisible: visible,
                    })
                ),
            { initialProps: { visible: true } }
        );

        rerender({ visible: false });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });

    it('recreates the series on its new pane when the pane index changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ pane }) =>
                useLinePaneChart(
                    params({ chartRef: makeChartRef(chart), paneIndex: pane })
                ),
            { initialProps: { pane: 3 } }
        );

        rerender({ pane: 4 });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
        expect(mockAddSeries).toHaveBeenLastCalledWith(
            'LineSeries',
            expect.objectContaining({ color: CHART_COLORS.cciLine }),
            4
        );
    });
});
