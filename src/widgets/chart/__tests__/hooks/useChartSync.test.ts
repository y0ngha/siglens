// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useChartSync } from '../../hooks/useChartSync';

vi.mock('lightweight-charts', () => ({}));

function makeMockChart(scaleWidth = 0) {
    const ts = {
        subscribeVisibleLogicalRangeChange: vi.fn(),
        unsubscribeVisibleLogicalRangeChange: vi.fn(),
        subscribeSizeChange: vi.fn(),
        unsubscribeSizeChange: vi.fn(),
        setVisibleLogicalRange: vi.fn(),
    };
    const priceScale = {
        width: vi.fn(() => scaleWidth),
        applyOptions: vi.fn(),
    };
    return {
        timeScale: () => ts,
        priceScale: () => priceScale,
        applyOptions: vi.fn(),
        _timeScaleMock: ts,
        _priceScaleMock: priceScale,
    };
}

const frames: FrameRequestCallback[] = [];
/** 예약된 프레임을 실행한다 — 브라우저처럼 예약 호출이 끝난 뒤에 돈다. */
function flushFrames() {
    for (const cb of frames.splice(0)) cb(0);
}

beforeEach(() => {
    frames.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        frames.push(cb);
        return frames.length;
    });
});

describe('useChartSync', () => {
    it('returns four handler functions', () => {
        const { result } = renderHook(() => useChartSync());

        expect(typeof result.current.handleStockChartReady).toBe('function');
        expect(typeof result.current.handleStockChartRemove).toBe('function');
        expect(typeof result.current.handleVolumeChartReady).toBe('function');
        expect(typeof result.current.handleVolumeChartRemove).toBe('function');
        expect(typeof result.current.setRightOffsetPixels).toBe('function');
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

    describe('setRightOffsetPixels', () => {
        type Chart = Parameters<
            ReturnType<typeof useChartSync>['handleStockChartReady']
        >[0];
        const asChart = (chart: unknown) => chart as Chart;

        it('가격·거래량 차트 둘 다 시간축 rightOffsetPixels를 적용한다', () => {
            const { result } = renderHook(() => useChartSync());
            const stockChart = makeMockChart();
            const volumeChart = makeMockChart();
            result.current.handleStockChartReady(asChart(stockChart));
            result.current.handleVolumeChartReady(asChart(volumeChart));

            result.current.setRightOffsetPixels(88);

            expect(stockChart.applyOptions).toHaveBeenCalledWith({
                timeScale: { rightOffsetPixels: 88 },
            });
            expect(volumeChart.applyOptions).toHaveBeenCalledWith({
                timeScale: { rightOffsetPixels: 88 },
            });
        });

        it('같은 값을 다시 주면 다시 적용하지 않는다(스크롤 위치를 불필요하게 되돌리지 않는다)', () => {
            const { result } = renderHook(() => useChartSync());
            const stockChart = makeMockChart();
            result.current.handleStockChartReady(asChart(stockChart));

            result.current.setRightOffsetPixels(88);
            result.current.setRightOffsetPixels(88);

            expect(stockChart.applyOptions).toHaveBeenCalledTimes(1);
        });

        it('0으로 되돌리면 여백을 해제한다', () => {
            const { result } = renderHook(() => useChartSync());
            const stockChart = makeMockChart();
            result.current.handleStockChartReady(asChart(stockChart));
            result.current.setRightOffsetPixels(88);

            result.current.setRightOffsetPixels(0);

            expect(stockChart.applyOptions).toHaveBeenLastCalledWith({
                timeScale: { rightOffsetPixels: 0 },
            });
        });

        it('차트가 아직 없으면 던지지 않고, 나중에 준비되는 두 차트에 기억해 둔 값을 입힌다', () => {
            const { result } = renderHook(() => useChartSync());
            expect(() => result.current.setRightOffsetPixels(64)).not.toThrow();

            const stockChart = makeMockChart();
            const volumeChart = makeMockChart();
            result.current.handleStockChartReady(asChart(stockChart));
            result.current.handleVolumeChartReady(asChart(volumeChart));

            expect(stockChart.applyOptions).toHaveBeenCalledWith({
                timeScale: { rightOffsetPixels: 64 },
            });
            expect(volumeChart.applyOptions).toHaveBeenCalledWith({
                timeScale: { rightOffsetPixels: 64 },
            });
        });

        it('여백이 0이면 새로 준비되는 차트에 옵션을 건드리지 않는다', () => {
            const { result } = renderHook(() => useChartSync());
            const stockChart = makeMockChart();

            result.current.handleStockChartReady(asChart(stockChart));

            expect(stockChart.applyOptions).not.toHaveBeenCalled();
        });

        it('제거된 차트에는 적용하지 않는다', () => {
            const { result } = renderHook(() => useChartSync());
            const stockChart = makeMockChart();
            result.current.handleStockChartReady(asChart(stockChart));
            result.current.handleStockChartRemove();

            result.current.setRightOffsetPixels(50);

            expect(stockChart.applyOptions).not.toHaveBeenCalled();
        });

        it('참조가 렌더 사이에 안정적이다', () => {
            const { result, rerender } = renderHook(() => useChartSync());
            const first = result.current.setRightOffsetPixels;

            rerender();

            expect(result.current.setRightOffsetPixels).toBe(first);
        });
    });
    describe('가격축 폭 맞추기', () => {
        type Chart = Parameters<
            ReturnType<typeof useChartSync>['handleStockChartReady']
        >[0];

        it('두 차트의 오른쪽 가격축 최소 폭을 넓은 쪽에 맞춘다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(56);

            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            flushFrames();

            expect(stock._priceScaleMock.applyOptions).toHaveBeenCalledWith({
                minimumWidth: 64,
            });
            expect(volume._priceScaleMock.applyOptions).toHaveBeenCalledWith({
                minimumWidth: 64,
            });
        });

        it('차트가 하나뿐이면 맞추지 않는다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);

            result.current.handleStockChartReady(stock as unknown as Chart);
            flushFrames();

            expect(stock._priceScaleMock.applyOptions).not.toHaveBeenCalled();
        });

        it('축 폭이 바뀌면(크기 변화 신호) 다시 맞추고, 같은 폭은 다시 입히지 않는다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(56);
            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            flushFrames();
            volume._priceScaleMock.applyOptions.mockClear();

            const onSize = volume._timeScaleMock.subscribeSizeChange.mock
                .calls[0]![0] as () => void;
            onSize();
            flushFrames();
            expect(volume._priceScaleMock.applyOptions).not.toHaveBeenCalled();

            volume._priceScaleMock.width.mockReturnValue(72);
            onSize();
            flushFrames();
            expect(volume._priceScaleMock.applyOptions).toHaveBeenCalledWith({
                minimumWidth: 72,
            });
            expect(stock._priceScaleMock.applyOptions).toHaveBeenLastCalledWith(
                { minimumWidth: 72 }
            );
        });

        it('넓은 라벨이 사라져 자연 폭이 줄어도 하한을 다시 입히지 않는다(래칫)', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(56);
            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            flushFrames();
            stock._priceScaleMock.applyOptions.mockClear();
            volume._priceScaleMock.applyOptions.mockClear();

            // 하한 64가 걸린 상태에서는 width()가 64 아래로 내려가지 않는다.
            stock._priceScaleMock.width.mockReturnValue(64);
            volume._priceScaleMock.width.mockReturnValue(64);
            const onRange = stock._timeScaleMock
                .subscribeVisibleLogicalRangeChange.mock
                .calls[1]![0] as () => void;
            onRange();
            flushFrames();
            expect(stock._priceScaleMock.applyOptions).not.toHaveBeenCalled();
            expect(volume._priceScaleMock.applyOptions).not.toHaveBeenCalled();
        });

        it('한 프레임에 신호가 몰려도 한 번만 잰다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(56);
            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            const onSize = stock._timeScaleMock.subscribeSizeChange.mock
                .calls[0]![0] as () => void;
            onSize();
            onSize();
            expect(frames).toHaveLength(1);
            flushFrames();
            expect(stock._priceScaleMock.width).toHaveBeenCalledTimes(1);
        });

        it('두 차트가 모두 사라진 뒤 도는 예약 프레임은 아무것도 하지 않는다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(56);
            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            result.current.handleStockChartRemove();
            result.current.handleVolumeChartRemove();
            stock._priceScaleMock.applyOptions.mockClear();
            volume._priceScaleMock.applyOptions.mockClear();

            expect(() => flushFrames()).not.toThrow();
            expect(stock._priceScaleMock.width).not.toHaveBeenCalled();
            expect(stock._priceScaleMock.applyOptions).not.toHaveBeenCalled();
            expect(volume._priceScaleMock.applyOptions).not.toHaveBeenCalled();
        });

        it('한쪽이 사라지면 남은 차트의 하한을 풀고, 새 짝과는 다시 잰다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(80);
            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            flushFrames();
            expect(stock._priceScaleMock.applyOptions).toHaveBeenLastCalledWith(
                {
                    minimumWidth: 80,
                }
            );

            result.current.handleVolumeChartRemove();
            expect(stock._priceScaleMock.applyOptions).toHaveBeenLastCalledWith(
                {
                    minimumWidth: 0,
                }
            );

            stock._priceScaleMock.width.mockReturnValue(64);
            const nextVolume = makeMockChart(56);
            result.current.handleVolumeChartReady(
                nextVolume as unknown as Chart
            );
            flushFrames();
            expect(stock._priceScaleMock.applyOptions).toHaveBeenLastCalledWith(
                {
                    minimumWidth: 64,
                }
            );
            expect(
                nextVolume._priceScaleMock.applyOptions
            ).toHaveBeenLastCalledWith({ minimumWidth: 64 });
        });

        it('제거된 차트의 크기 구독을 푼다', () => {
            const { result } = renderHook(() => useChartSync());
            const volume = makeMockChart(56);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            result.current.handleVolumeChartRemove();

            expect(
                volume._timeScaleMock.unsubscribeSizeChange
            ).toHaveBeenCalledWith(
                volume._timeScaleMock.subscribeSizeChange.mock.calls[0]![0]
            );
        });
    });
});
