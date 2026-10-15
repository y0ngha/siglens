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
        // 실제 차트처럼 그려지는 요소를 준다(사용자 입력 리스너가 여기에 걸린다)
        chartElement: () => document.createElement('div'),
        _timeScaleMock: ts,
        _priceScaleMock: priceScale,
    };
}

const frames: FrameRequestCallback[] = [];
/** 예약된 프레임을 실행한다 — 브라우저처럼 예약 호출이 끝난 뒤에 돈다. */
function flushFrames(): void {
    for (const cb of frames.splice(0)) cb(0);
}

beforeEach(() => {
    frames.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        frames.push(cb);
        return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
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

            expect(window.cancelAnimationFrame).toHaveBeenCalled();
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

        it('이미 dispose된 차트를 제거해도 throw하지 않고 정리를 끝낸다', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = makeMockChart(64);
            const volume = makeMockChart(56);
            result.current.handleStockChartReady(stock as unknown as Chart);
            result.current.handleVolumeChartReady(volume as unknown as Chart);
            const disposed = new Error('Object is disposed');
            volume._timeScaleMock.unsubscribeVisibleLogicalRangeChange.mockImplementation(
                () => {
                    throw disposed;
                }
            );
            stock._priceScaleMock.applyOptions.mockImplementation(() => {
                throw disposed;
            });

            expect(() =>
                result.current.handleVolumeChartRemove()
            ).not.toThrow();
            // 정리가 끝까지 갔다 — 새 짝이 붙으면 다시 잰다.
            stock._priceScaleMock.applyOptions.mockReset();
            const nextVolume = makeMockChart(56);
            result.current.handleVolumeChartReady(
                nextVolume as unknown as Chart
            );
            flushFrames();
            expect(
                nextVolume._priceScaleMock.applyOptions
            ).toHaveBeenCalledWith({ minimumWidth: 64 });
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

    describe('사용자 조정 기록(userAdjustedViewRef)', () => {
        function chartWithElement() {
            const chart = makeMockChart();
            const element = document.createElement('div');
            return {
                chart: {
                    ...chart,
                    chartElement: () => element,
                } as never,
                element,
            };
        }

        it('기본값은 false다', () => {
            const { result } = renderHook(() => useChartSync());
            expect(result.current.isUserAdjustedView()).toBe(false);
        });

        it.each(['pointerdown', 'wheel', 'touchstart'])(
            '가격 차트의 %s 입력으로 켜진다',
            type => {
                const { result } = renderHook(() => useChartSync());
                const { chart, element } = chartWithElement();
                result.current.handleStockChartReady(chart);
                element.dispatchEvent(new Event(type));
                expect(result.current.isUserAdjustedView()).toBe(true);
            }
        );

        it.each(['pointerdown', 'wheel', 'touchstart'])(
            '거래량 차트의 %s 입력으로도 켜진다',
            type => {
                const { result } = renderHook(() => useChartSync());
                const { chart, element } = chartWithElement();
                result.current.handleVolumeChartReady(chart);
                element.dispatchEvent(new Event(type));
                expect(result.current.isUserAdjustedView()).toBe(true);
            }
        );

        it('차트가 제거되면 입력 리스너를 뗀다(가격·거래량 모두)', () => {
            const { result } = renderHook(() => useChartSync());
            const stock = chartWithElement();
            const volume = chartWithElement();
            result.current.handleStockChartReady(stock.chart);
            result.current.handleVolumeChartReady(volume.chart);
            result.current.handleStockChartRemove();
            result.current.handleVolumeChartRemove();

            stock.element.dispatchEvent(new Event('wheel'));
            volume.element.dispatchEvent(new Event('pointerdown'));
            expect(result.current.isUserAdjustedView()).toBe(false);
        });

        it('resetUserAdjustedView가 기록을 지운다', () => {
            const { result } = renderHook(() => useChartSync());
            const { chart, element } = chartWithElement();
            result.current.handleStockChartReady(chart);
            element.dispatchEvent(new Event('wheel'));
            expect(result.current.isUserAdjustedView()).toBe(true);
            result.current.resetUserAdjustedView();
            expect(result.current.isUserAdjustedView()).toBe(false);
        });
    });

    describe('runVolumeDataUpdate — 거래량 갱신이 가격 차트의 범위를 덮지 않는다', () => {
        function pair() {
            const stock = makeMockChart();
            const volume = makeMockChart();
            const stockTs = stock._timeScaleMock as Record<string, unknown>;
            stockTs.getVisibleLogicalRange = vi.fn(() => ({
                from: 10,
                to: 90,
            }));
            const { result } = renderHook(() => useChartSync());
            result.current.handleStockChartReady(stock as never);
            result.current.handleVolumeChartReady(volume as never);
            // 같은 이벤트에 축 폭 맞춤 콜백(인자 없음)도 구독된다 — 범위 인자를 받는 쪽이 동기화 핸들러다.
            const volumeHandler =
                volume._timeScaleMock.subscribeVisibleLogicalRangeChange.mock.calls
                    .map(
                        ([handler]) =>
                            handler as (
                                r: { from: number; to: number } | null
                            ) => void
                    )
                    .find(handler => handler.length === 1)!;
            return { stock, volume, result, volumeHandler };
        }

        it('갱신 밖의 거래량 범위 변경(사용자가 거래량을 밂)은 가격 차트로 전해진다', () => {
            const { stock, volumeHandler } = pair();
            volumeHandler({ from: 1, to: 2 });
            expect(
                stock._timeScaleMock.setVisibleLogicalRange
            ).toHaveBeenCalledWith({
                from: 1,
                to: 2,
            });
        });

        it('갱신 중 거래량이 내는 범위 변경(오른쪽 여백 보정)은 가격 차트로 전해지지 않는다', () => {
            const { stock, result, volumeHandler } = pair();
            result.current.runVolumeDataUpdate(() => {
                volumeHandler({ from: 500, to: 900 }); // 낡은 범위
            });
            expect(
                stock._timeScaleMock.setVisibleLogicalRange
            ).not.toHaveBeenCalledWith({
                from: 500,
                to: 900,
            });
        });

        it('갱신이 끝나면 거래량 차트를 가격 차트의 현재 범위에 맞춘다', () => {
            const { volume, result } = pair();
            const update = vi.fn();
            result.current.runVolumeDataUpdate(update);
            expect(update).toHaveBeenCalledTimes(1);
            expect(
                volume._timeScaleMock.setVisibleLogicalRange
            ).toHaveBeenCalledWith({
                from: 10,
                to: 90,
            });
        });

        it('갱신이 던져도 억제를 풀어 이후 범위 전달이 막히지 않는다', () => {
            const { stock, result, volumeHandler } = pair();
            expect(() =>
                result.current.runVolumeDataUpdate(() => {
                    throw new Error('setData failed');
                })
            ).toThrow('setData failed');
            volumeHandler({ from: 7, to: 8 });
            expect(
                stock._timeScaleMock.setVisibleLogicalRange
            ).toHaveBeenCalledWith({
                from: 7,
                to: 8,
            });
        });

        it('가격 차트가 아직 범위를 모르면(null) 맞추지 않고 갱신만 한다', () => {
            const { stock, volume, result } = pair();
            (
                stock._timeScaleMock as Record<string, unknown>
            ).getVisibleLogicalRange = vi.fn(() => null);
            const update = vi.fn();
            result.current.runVolumeDataUpdate(update);
            expect(update).toHaveBeenCalled();
            expect(
                volume._timeScaleMock.setVisibleLogicalRange
            ).not.toHaveBeenCalled();
        });
    });
});
