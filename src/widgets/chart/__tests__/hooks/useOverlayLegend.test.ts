// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useOverlayLegend } from '../../hooks/useOverlayLegend';
import type { OverlayLabelConfig } from '../../utils/overlayLabelUtils';

const mockSubscribeCrosshairMove = vi.fn();
const mockUnsubscribeCrosshairMove = vi.fn();

vi.mock('lightweight-charts', () => ({}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useOverlayLegend
    >[0]['chartRef'];
}

function makeChart() {
    return {
        subscribeCrosshairMove: mockSubscribeCrosshairMove,
        unsubscribeCrosshairMove: mockUnsubscribeCrosshairMove,
    };
}

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

const INDICATORS = {
    ma: { 20: [100, 101] },
} as unknown as IndicatorResult;

const LABEL_CONFIGS: OverlayLabelConfig[] = [
    {
        name: 'MA(20)',
        color: '#eab308',
        getValue: (ind: IndicatorResult, i: number): number | null =>
            (ind.ma as Record<number, (number | null)[]>)[20]?.[i] ?? null,
    },
];

describe('useOverlayLegend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns legend items with null values when bars are empty', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(result.current).toHaveLength(1);
        expect(result.current[0].value).toBeNull();
    });

    it('returns legend items with last bar values by default', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(result.current).toHaveLength(1);
        expect(result.current[0].name).toBe('MA(20)');
        expect(result.current[0].value).toBe(101);
    });

    it('returns empty array when no label configs provided', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: [],
            })
        );

        expect(result.current).toEqual([]);
    });

    it('subscribes to crosshair move when chart exists', () => {
        renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(mockSubscribeCrosshairMove).toHaveBeenCalled();
    });

    it('does not subscribe when chart is null', () => {
        renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(mockSubscribeCrosshairMove).not.toHaveBeenCalled();
    });

    it('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        unmount();

        expect(mockUnsubscribeCrosshairMove).toHaveBeenCalled();
    });

    it('preserves color from label config', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(result.current[0].color).toBe('#eab308');
    });
});
