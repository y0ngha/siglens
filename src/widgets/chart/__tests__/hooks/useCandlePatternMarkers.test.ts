// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar } from '@y0ngha/siglens-core';
import { useCandlePatternMarkers } from '../../hooks/useCandlePatternMarkers';

const mockSetMarkers = vi.fn();
const mockDetach = vi.fn();
const mockCreateSeriesMarkers = vi.fn(
    (_series: unknown, _markers: unknown) => ({
        setMarkers: mockSetMarkers,
        detach: mockDetach,
    })
);

vi.mock('lightweight-charts', () => ({
    createSeriesMarkers: (series: unknown, markers: unknown) =>
        mockCreateSeriesMarkers(series, markers),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    detectCandlePatternEntries: vi.fn(() => []),
    getDetectionBars: vi.fn((bars: Bar[]) => bars),
    selectLastCandlePatternEntries: vi.fn(() => []),
    getCandlePatternLabel: vi.fn(() => 'Pattern'),
    getMultiCandlePatternLabel: vi.fn(() => 'MultiPattern'),
    getMultiPatternTrend: vi.fn(() => 'bullish'),
    getSinglePatternTrend: vi.fn(() => 'bearish'),
}));

function makeSeriesRef(series: unknown = null) {
    return { current: series } as Parameters<
        typeof useCandlePatternMarkers
    >[0]['seriesRef'];
}

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

describe('useCandlePatternMarkers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(),
                bars: [],
            })
        );

        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible', () => {
        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(),
                bars: [],
            })
        );

        act(() => {
            result.current.toggle();
        });
        expect(result.current.isVisible).toBe(true);
    });

    it('creates series markers plugin when seriesRef has value', () => {
        renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        expect(mockCreateSeriesMarkers).toHaveBeenCalled();
    });

    it('does not create markers plugin when seriesRef is null', () => {
        renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(null),
                bars: FAKE_BARS,
            })
        );

        expect(mockCreateSeriesMarkers).not.toHaveBeenCalled();
    });

    it('sets empty markers when not visible', () => {
        renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        expect(mockSetMarkers).toHaveBeenCalledWith([]);
    });

    it('detaches plugin on unmount', () => {
        const { unmount } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        unmount();

        expect(mockDetach).toHaveBeenCalled();
    });

    it('provides stable toggle reference', () => {
        const { result, rerender } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(),
                bars: [],
            })
        );

        const firstToggle = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(firstToggle);
    });
});
