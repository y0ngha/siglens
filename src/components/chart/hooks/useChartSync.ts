'use client';

import { useCallback, useRef } from 'react';
import type { IChartApi, LogicalRange } from 'lightweight-charts';

interface ChartSyncHandlers {
    handleStockChartReady: (chart: IChartApi) => void;
    handleStockChartRemove: () => void;
    handleVolumeChartReady: (chart: IChartApi) => void;
    handleVolumeChartRemove: () => void;
}

export function useChartSync(): ChartSyncHandlers {
    const stockChartRef = useRef<IChartApi | null>(null);
    const volumeChartRef = useRef<IChartApi | null>(null);
    const stockHandlerRef = useRef<
        ((range: LogicalRange | null) => void) | null
    >(null);
    const volumeHandlerRef = useRef<
        ((range: LogicalRange | null) => void) | null
    >(null);

    const handleStockChartReady = useCallback((chart: IChartApi): void => {
        stockChartRef.current = chart;
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

    return {
        handleStockChartReady,
        handleStockChartRemove,
        handleVolumeChartReady,
        handleVolumeChartRemove,
    };
}
