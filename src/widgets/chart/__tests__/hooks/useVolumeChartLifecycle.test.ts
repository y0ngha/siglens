// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useVolumeChartLifecycle } from '../../hooks/useVolumeChartLifecycle';

const mockAddSeries = vi.fn(() => ({}));
const mockRemove = vi.fn();
const mockApplyOptions = vi.fn();
const mockFitContent = vi.fn();
const mockCreateChart = vi.fn((_container: unknown, _options: unknown) => ({
    addSeries: mockAddSeries,
    remove: mockRemove,
    applyOptions: mockApplyOptions,
    timeScale: () => ({ fitContent: mockFitContent }),
}));

vi.mock('lightweight-charts', () => ({
    createChart: (container: unknown, options: unknown) =>
        mockCreateChart(container, options),
    HistogramSeries: 'HistogramSeries',
}));

function makeContainerRef(container: HTMLDivElement | null = null) {
    return { current: container } as Parameters<
        typeof useVolumeChartLifecycle
    >[0]['containerRef'];
}

describe('useVolumeChartLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns chartRef, totalSeriesRef, buySeriesRef', () => {
        const { result } = renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(),
            })
        );

        expect(result.current.chartRef).toBeDefined();
        expect(result.current.totalSeriesRef).toBeDefined();
        expect(result.current.buySeriesRef).toBeDefined();
    });

    it('does not create chart when container is null', () => {
        renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(null),
            })
        );

        expect(mockCreateChart).not.toHaveBeenCalled();
    });

    it('creates chart when container exists', () => {
        const container = document.createElement('div');
        renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(container),
            })
        );

        expect(mockCreateChart).toHaveBeenCalledWith(
            container,
            expect.any(Object)
        );
    });

    it('adds two histogram series for total and buy volume', () => {
        const container = document.createElement('div');
        renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(container),
            })
        );

        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('calls onChartReady callback', () => {
        const container = document.createElement('div');
        const onReady = vi.fn();

        renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(container),
                onChartReady: onReady,
            })
        );

        expect(onReady).toHaveBeenCalled();
    });

    it('calls onChartRemove and removes chart on unmount', () => {
        const container = document.createElement('div');
        const onRemove = vi.fn();

        const { unmount } = renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(container),
                onChartRemove: onRemove,
            })
        );

        unmount();

        expect(onRemove).toHaveBeenCalled();
        expect(mockRemove).toHaveBeenCalled();
    });

    it('disables autoSize before removing chart on cleanup', () => {
        const container = document.createElement('div');

        const { unmount } = renderHook(() =>
            useVolumeChartLifecycle({
                containerRef: makeContainerRef(container),
            })
        );

        unmount();

        expect(mockApplyOptions).toHaveBeenCalledWith({ autoSize: false });
    });
});
