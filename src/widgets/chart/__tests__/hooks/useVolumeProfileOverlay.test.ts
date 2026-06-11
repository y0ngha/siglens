// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useVolumeProfileOverlay } from '../../hooks/useVolumeProfileOverlay';
import { STORAGE_KEYS } from '../../constants';

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

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useVolumeProfileOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const NO_VP_INDICATORS = {
    volumeProfile: null,
} as unknown as IndicatorResult;

const VP_INDICATORS = {
    volumeProfile: { poc: 100, vah: 110, val: 90 },
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

describe('useVolumeProfileOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: NO_VP_INDICATORS,
            })
        );

        expect(result.current.isVisible).toBe(false);
    });

    it('toggles visibility', () => {
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: NO_VP_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });
        expect(result.current.isVisible).toBe(true);

        act(() => {
            result.current.toggle();
        });
        expect(result.current.isVisible).toBe(false);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: VP_INDICATORS,
            })
        );

        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates three series (POC, VAH, VAL) when visible', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: VP_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockAddSeries).toHaveBeenCalledTimes(3);
    });

    it('removes series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: VP_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });
        act(() => {
            result.current.toggle();
        });

        expect(mockRemoveSeries).toHaveBeenCalled();
    });

    it('sets empty data when volumeProfile is null', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: NO_VP_INDICATORS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        expect(mockSetData).toHaveBeenCalledWith([]);
    });

    it('persists isVisible to localStorage on toggle', () => {
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: NO_VP_INDICATORS,
            })
        );
        act(() => {
            result.current.toggle();
        });
        expect(
            localStorage.getItem(STORAGE_KEYS.overlay('volumeProfile'))
        ).toBe('true');
    });

    it('restores isVisible true from localStorage on mount', () => {
        localStorage.setItem(STORAGE_KEYS.overlay('volumeProfile'), 'true');
        const { result } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: NO_VP_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(true);
    });

    it('provides stable toggle reference', () => {
        const { result, rerender } = renderHook(() =>
            useVolumeProfileOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: NO_VP_INDICATORS,
            })
        );

        const firstToggle = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(firstToggle);
    });
});
