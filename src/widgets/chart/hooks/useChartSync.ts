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

    const handleStockChartReady = useCallback((chart: IChartApi): void => {
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
    }, []);

    const handleStockChartRemove = useCallback((): void => {
        const chart = stockChartRef.current;
        const handler = stockHandlerRef.current;
        if (chart && handler) {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        }
        stockChartRef.current = null;
        stockHandlerRef.current = null;
    }, []);

    const handleVolumeChartReady = useCallback((chart: IChartApi): void => {
        volumeChartRef.current = chart;
        if (rightOffsetPixelsRef.current > 0) {
            applyRightOffsetPixels(chart, rightOffsetPixelsRef.current);
        }
        const handler = (range: LogicalRange | null) => {
            if (range !== null && stockChartRef.current !== null) {
                stockChartRef.current.timeScale().setVisibleLogicalRange(range);
            }
        };
        volumeHandlerRef.current = handler;
        chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    }, []);

    const handleVolumeChartRemove = useCallback((): void => {
        const chart = volumeChartRef.current;
        const handler = volumeHandlerRef.current;
        if (chart && handler) {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        }
        volumeChartRef.current = null;
        volumeHandlerRef.current = null;
    }, []);

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
