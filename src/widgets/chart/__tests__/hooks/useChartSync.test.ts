// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useChartSync } from '../../hooks/useChartSync';

vi.mock('lightweight-charts', () => ({}));

function makeMockChart() {
    const ts = {
        subscribeVisibleLogicalRangeChange: vi.fn(),
        unsubscribeVisibleLogicalRangeChange: vi.fn(),
        setVisibleLogicalRange: vi.fn(),
    };
    return {
        timeScale: () => ts,
        _timeScaleMock: ts,
    };
}

describe('useChartSync', () => {
    it('returns four handler functions', () => {
        const { result } = renderHook(() => useChartSync());

        expect(typeof result.current.handleStockChartReady).toBe('function');
        expect(typeof result.current.handleStockChartRemove).toBe('function');
        expect(typeof result.current.handleVolumeChartReady).toBe('function');
        expect(typeof result.current.handleVolumeChartRemove).toBe('function');
    });

    it('provides stable handler references across re-renders', () => {
        const { result, rerender } = renderHook(() => useChartSync());

        const firstHandlers = { ...result.current };
        rerender();

        expect(result.current.handleStockChartReady).toBe(
            firstHandlers.handleStockChartReady
        );
        expect(result.current.handleStockChartRemove).toBe(
            firstHandlers.handleStockChartRemove
        );
        expect(result.current.handleVolumeChartReady).toBe(
            firstHandlers.handleVolumeChartReady
        );
        expect(result.current.handleVolumeChartRemove).toBe(
            firstHandlers.handleVolumeChartRemove
        );
    });

    it('subscribes to visible range changes on stock chart ready', () => {
        const { result } = renderHook(() => useChartSync());
        const mockChart = makeMockChart();

        result.current.handleStockChartReady(
            mockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );

        expect(
            mockChart._timeScaleMock.subscribeVisibleLogicalRangeChange
        ).toHaveBeenCalled();
    });

    it('subscribes to visible range changes on volume chart ready', () => {
        const { result } = renderHook(() => useChartSync());
        const mockChart = makeMockChart();

        result.current.handleVolumeChartReady(
            mockChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );

        expect(
            mockChart._timeScaleMock.subscribeVisibleLogicalRangeChange
        ).toHaveBeenCalled();
    });

    it('unsubscribes on stock chart remove', () => {
        const { result } = renderHook(() => useChartSync());
        const mockChart = makeMockChart();

        result.current.handleStockChartReady(
            mockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );
        result.current.handleStockChartRemove();

        expect(
            mockChart._timeScaleMock.unsubscribeVisibleLogicalRangeChange
        ).toHaveBeenCalled();
    });

    it('unsubscribes on volume chart remove', () => {
        const { result } = renderHook(() => useChartSync());
        const mockChart = makeMockChart();

        result.current.handleVolumeChartReady(
            mockChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );
        result.current.handleVolumeChartRemove();

        expect(
            mockChart._timeScaleMock.unsubscribeVisibleLogicalRangeChange
        ).toHaveBeenCalled();
    });

    it('does not throw when removing chart before ready', () => {
        const { result } = renderHook(() => useChartSync());

        expect(() => result.current.handleStockChartRemove()).not.toThrow();
        expect(() => result.current.handleVolumeChartRemove()).not.toThrow();
    });

    it('stock handler syncs volume chart range when both are ready', () => {
        const { result } = renderHook(() => useChartSync());
        const stockChart = makeMockChart();
        const volumeChart = makeMockChart();

        result.current.handleStockChartReady(
            stockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );
        result.current.handleVolumeChartReady(
            volumeChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );

        // Get the handler that was subscribed on the stock chart
        const handler =
            stockChart._timeScaleMock.subscribeVisibleLogicalRangeChange.mock
                .calls[0][0];

        // Simulate range change on stock chart
        const range = { from: 0, to: 100 };
        handler(range);

        expect(
            volumeChart._timeScaleMock.setVisibleLogicalRange
        ).toHaveBeenCalledWith(range);
    });

    it('stock handler does nothing when range is null', () => {
        const { result } = renderHook(() => useChartSync());
        const stockChart = makeMockChart();
        const volumeChart = makeMockChart();

        result.current.handleStockChartReady(
            stockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );
        result.current.handleVolumeChartReady(
            volumeChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );

        const handler =
            stockChart._timeScaleMock.subscribeVisibleLogicalRangeChange.mock
                .calls[0][0];

        handler(null);

        expect(
            volumeChart._timeScaleMock.setVisibleLogicalRange
        ).not.toHaveBeenCalled();
    });

    it('stock handler does nothing when volume chart is not ready', () => {
        const { result } = renderHook(() => useChartSync());
        const stockChart = makeMockChart();

        result.current.handleStockChartReady(
            stockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );

        const handler =
            stockChart._timeScaleMock.subscribeVisibleLogicalRangeChange.mock
                .calls[0][0];

        // Volume chart not ready, should not throw
        expect(() => handler({ from: 0, to: 100 })).not.toThrow();
    });

    it('volume handler syncs stock chart range when both are ready', () => {
        const { result } = renderHook(() => useChartSync());
        const stockChart = makeMockChart();
        const volumeChart = makeMockChart();

        result.current.handleStockChartReady(
            stockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );
        result.current.handleVolumeChartReady(
            volumeChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );

        const handler =
            volumeChart._timeScaleMock.subscribeVisibleLogicalRangeChange.mock
                .calls[0][0];

        const range = { from: 10, to: 50 };
        handler(range);

        expect(
            stockChart._timeScaleMock.setVisibleLogicalRange
        ).toHaveBeenCalledWith(range);
    });

    it('volume handler does nothing when range is null', () => {
        const { result } = renderHook(() => useChartSync());
        const stockChart = makeMockChart();
        const volumeChart = makeMockChart();

        result.current.handleStockChartReady(
            stockChart as unknown as Parameters<
                typeof result.current.handleStockChartReady
            >[0]
        );
        result.current.handleVolumeChartReady(
            volumeChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );

        const handler =
            volumeChart._timeScaleMock.subscribeVisibleLogicalRangeChange.mock
                .calls[0][0];

        handler(null);

        expect(
            stockChart._timeScaleMock.setVisibleLogicalRange
        ).not.toHaveBeenCalled();
    });

    it('volume handler does nothing when stock chart is not ready', () => {
        const { result } = renderHook(() => useChartSync());
        const volumeChart = makeMockChart();

        result.current.handleVolumeChartReady(
            volumeChart as unknown as Parameters<
                typeof result.current.handleVolumeChartReady
            >[0]
        );

        const handler =
            volumeChart._timeScaleMock.subscribeVisibleLogicalRangeChange.mock
                .calls[0][0];

        expect(() => handler({ from: 0, to: 100 })).not.toThrow();
    });
});
