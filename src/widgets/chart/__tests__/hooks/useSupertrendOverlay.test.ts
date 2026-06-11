// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useSupertrendOverlay } from '../../hooks/useSupertrendOverlay';
import { STORAGE_KEYS } from '../../constants';
import { buildTrendSplitData } from '../../utils/seriesDataUtils';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildTrendSplitData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useSupertrendOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    supertrend: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    supertrend: [{ supertrend: 10, trend: 'up' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useSupertrendOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(true);
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(false);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two LineSeries (up, down) when visible and chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).toHaveBeenCalledTimes(2);

        // 두 시리즈가 각각 올바른 방향('up'/'down')으로 분리 호출되는지 명시 검증
        // — 호출 횟수만 보면 둘 다 'up'으로 잘못 호출돼도 통과하므로 인자까지 고정한다.
        const splitMock = vi.mocked(buildTrendSplitData);
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.supertrend,
            'up',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.supertrend,
            'down',
            expect.any(Function)
        );
    });

    it('re-sets data on both series when bars change while visible', () => {
        const chart = makeChart();
        const { result, rerender } = renderHook(
            ({ bars }) =>
                useSupertrendOverlay({
                    chartRef: makeChartRef(chart),
                    bars,
                    indicators: FILLED_INDICATORS,
                }),
            { initialProps: { bars: FAKE_BARS } }
        );
        act(() => result.current.toggle());
        vi.clearAllMocks();

        const newBars: Bar[] = [
            {
                time: 2000,
                open: 200,
                high: 220,
                low: 180,
                close: 210,
                volume: 2000,
            },
        ];
        rerender({ bars: newBars });

        // 데이터-싱크 effect 의존성([indicators, bars, isVisible])이 bars 변경에 반응해
        // up/down 두 시리즈를 모두 다시 setData 하는지 검증.
        expect(mockSetData).toHaveBeenCalledTimes(2);
        const splitMock = vi.mocked(buildTrendSplitData);
        expect(splitMock).toHaveBeenCalledWith(
            newBars,
            FILLED_INDICATORS.supertrend,
            'up',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            newBars,
            FILLED_INDICATORS.supertrend,
            'down',
            expect.any(Function)
        );
    });

    it('does not set data when supertrend is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('persists isVisible to localStorage on toggle', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => {
            result.current.toggle();
        });
        expect(localStorage.getItem(STORAGE_KEYS.overlay('supertrend'))).toBe(
            'true'
        );
    });

    it('restores isVisible true from localStorage on mount', () => {
        localStorage.setItem(STORAGE_KEYS.overlay('supertrend'), 'true');
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(true);
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useSupertrendOverlay({
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
