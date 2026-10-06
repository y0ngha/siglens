'use client';

import { useCallback, useRef } from 'react';
import type { IChartApi, LogicalRange } from 'lightweight-charts';

interface ChartSyncHandlers {
    handleStockChartReady: (chart: IChartApi) => void;
    handleStockChartRemove: () => void;
    handleVolumeChartReady: (chart: IChartApi) => void;
    handleVolumeChartRemove: () => void;
    /**
     * 두 차트 시간축의 오른쪽 여백(px). 레벨선 제목이 마지막 캔들을 덮지 않게
     * 마지막 봉을 그만큼 왼쪽으로 민다. 두 차트에 **같은 값**을 줘야 보이는 범위
     * 동기화가 어긋나지 않는다. 값은 기억해 뒀다가 나중에 만들어지는(remount) 차트에도
     * 적용한다.
     */
    setRightOffsetPixels: (pixels: number) => void;
}

function applyRightOffsetPixels(chart: IChartApi, pixels: number): void {
    chart.applyOptions({ timeScale: { rightOffsetPixels: pixels } });
}

/**
 * 두 차트의 오른쪽 가격축 폭을 큰 쪽에 맞춘다.
 *
 * 보이는 범위(logical range)를 맞춰도 가격축 폭이 다르면 그 범위를 서로 다른 폭에
 * 펼치게 되어, 봉 간격이 달라지고 오른쪽으로 갈수록 캔들과 거래량 막대가 어긋난다
 * (2026-10-06 제보: 가격축 `70.00`과 거래량축 `5.75M`의 폭이 8px 달라 마지막
 * 봉 근처에서 눈에 띄게 밀렸다). 축 폭은 라벨 글자 수로 정해지므로 확대·스크롤·
 * 리사이즈마다 다시 맞춘다.
 *
 * `minimumWidth`는 하한이라 한 번 넓어지면 두 차트 중 하나가 다시 만들어질 때까지
 * 줄지 않는다 — 넓은 라벨이 사라진 뒤에 축이 몇 px 남는 것이 두 차트가 어긋나는
 * 것보다 낫다. 한쪽이 사라지면 `releaseScaleWidthFloor`가 하한을 푼다.
 */
function syncPriceScaleWidths(
    charts: readonly IChartApi[],
    applied: Map<IChartApi, number>
): void {
    const width = Math.max(...charts.map(c => c.priceScale('right').width()));
    if (width <= 0) return;
    for (const chart of charts) {
        if (applied.get(chart) === width) continue;
        applied.set(chart, width);
        chart.priceScale('right').applyOptions({ minimumWidth: width });
    }
}

export function useChartSync(): ChartSyncHandlers {
    const stockChartRef = useRef<IChartApi | null>(null);
    const volumeChartRef = useRef<IChartApi | null>(null);
    // 0 = 여백 없음. 차트가 (재)생성될 때 이 값을 다시 입힌다.
    const rightOffsetPixelsRef = useRef(0);
    const stockHandlerRef = useRef<
        ((range: LogicalRange | null) => void) | null
    >(null);
    const volumeHandlerRef = useRef<
        ((range: LogicalRange | null) => void) | null
    >(null);
    // 차트마다 마지막으로 입힌 가격축 최소 폭 — 같은 값을 다시 입히지 않는다.
    const appliedScaleWidthRef = useRef(new Map<IChartApi, number>());
    const scaleFrameRef = useRef<number | null>(null);

    /*
     * 한쪽 차트가 사라지면 남은 차트의 하한을 풀고 기록을 비운다. 그대로 두면 다시
     * 만들어진 차트(종목·테마 전환)가 남은 차트의 옛 최대 폭에 끌려가, 하한이 차트
     * 수명이 아니라 세션 내내 유지된다. 새 짝이 붙으면 그때 다시 잰다.
     */
    const releaseScaleWidthFloor = useCallback(
        (survivor: IChartApi | null): void => {
            appliedScaleWidthRef.current.clear();
            if (survivor === null) {
                // 둘 다 사라졌다 — 예약된 측정은 할 일이 없다.
                if (scaleFrameRef.current !== null) {
                    cancelAnimationFrame(scaleFrameRef.current);
                    scaleFrameRef.current = null;
                }
                return;
            }
            try {
                survivor.priceScale('right').applyOptions({ minimumWidth: 0 });
            } catch {
                // 남은 차트도 이미 제거됐다(언마운트 순서) — 풀 하한이 없다.
            }
        },
        []
    );

    // 축 폭은 그린 뒤에야 정해지므로 다음 프레임에 잰다. 여러 신호가 한 프레임에
    // 몰려도 한 번만 잰다.
    const scheduleScaleWidthSync = useCallback((): void => {
        if (scaleFrameRef.current !== null) return;
        scaleFrameRef.current = requestAnimationFrame(() => {
            scaleFrameRef.current = null;
            const stock = stockChartRef.current;
            const volume = volumeChartRef.current;
            if (stock === null || volume === null) return;
            syncPriceScaleWidths([stock, volume], appliedScaleWidthRef.current);
        });
    }, []);

    /**
     * 사라지는 차트의 구독을 푼다. 차트가 먼저 dispose된 경우(언마운트 순서)에
     * 구독 해제가 throw해도 나머지 정리(ref 비우기·하한 풀기)는 계속돼야 한다.
     */
    const detachChart = useCallback(
        (
            chart: IChartApi | null,
            handler: ((range: LogicalRange | null) => void) | null
        ): void => {
            if (chart === null) return;
            try {
                const timeScale = chart.timeScale();
                if (handler !== null) {
                    timeScale.unsubscribeVisibleLogicalRangeChange(handler);
                }
                timeScale.unsubscribeVisibleLogicalRangeChange(
                    scheduleScaleWidthSync
                );
                timeScale.unsubscribeSizeChange(scheduleScaleWidthSync);
            } catch {
                // 이미 제거된 차트 — 풀 구독이 없다.
            }
        },
        [scheduleScaleWidthSync]
    );

    const handleStockChartReady = useCallback(
        (chart: IChartApi): void => {
            stockChartRef.current = chart;
            if (rightOffsetPixelsRef.current > 0) {
                applyRightOffsetPixels(chart, rightOffsetPixelsRef.current);
            }
            const handler = (range: LogicalRange | null) => {
                if (range !== null && volumeChartRef.current !== null) {
                    volumeChartRef.current
                        .timeScale()
                        .setVisibleLogicalRange(range);
                }
            };
            stockHandlerRef.current = handler;
            chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
            chart
                .timeScale()
                .subscribeVisibleLogicalRangeChange(scheduleScaleWidthSync);
            chart.timeScale().subscribeSizeChange(scheduleScaleWidthSync);
            scheduleScaleWidthSync();
        },
        [scheduleScaleWidthSync]
    );

    const handleStockChartRemove = useCallback((): void => {
        detachChart(stockChartRef.current, stockHandlerRef.current);
        stockChartRef.current = null;
        stockHandlerRef.current = null;
        releaseScaleWidthFloor(volumeChartRef.current);
    }, [detachChart, releaseScaleWidthFloor]);

    const handleVolumeChartReady = useCallback(
        (chart: IChartApi): void => {
            volumeChartRef.current = chart;
            if (rightOffsetPixelsRef.current > 0) {
                applyRightOffsetPixels(chart, rightOffsetPixelsRef.current);
            }
            const handler = (range: LogicalRange | null) => {
                if (range !== null && stockChartRef.current !== null) {
                    stockChartRef.current
                        .timeScale()
                        .setVisibleLogicalRange(range);
                }
            };
            volumeHandlerRef.current = handler;
            chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
            chart
                .timeScale()
                .subscribeVisibleLogicalRangeChange(scheduleScaleWidthSync);
            chart.timeScale().subscribeSizeChange(scheduleScaleWidthSync);
            scheduleScaleWidthSync();
        },
        [scheduleScaleWidthSync]
    );

    const handleVolumeChartRemove = useCallback((): void => {
        detachChart(volumeChartRef.current, volumeHandlerRef.current);
        volumeChartRef.current = null;
        volumeHandlerRef.current = null;
        releaseScaleWidthFloor(stockChartRef.current);
    }, [detachChart, releaseScaleWidthFloor]);

    const setRightOffsetPixels = useCallback((pixels: number): void => {
        if (rightOffsetPixelsRef.current === pixels) return;
        rightOffsetPixelsRef.current = pixels;
        for (const chart of [stockChartRef.current, volumeChartRef.current]) {
            if (chart !== null) applyRightOffsetPixels(chart, pixels);
        }
    }, []);

    return {
        handleStockChartReady,
        handleStockChartRemove,
        handleVolumeChartReady,
        handleVolumeChartRemove,
        setRightOffsetPixels,
    };
}
