'use client';

import { useCallback, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';

interface ChartSyncHandlers {
    handleStockChartReady: (chart: IChartApi) => void;
    handleVolumeChartReady: (chart: IChartApi) => void;
}

export function useChartSync(): ChartSyncHandlers {
    const stockChartRef = useRef<IChartApi | null>(null);
    const volumeChartRef = useRef<IChartApi | null>(null);

    const handleStockChartReady = useCallback((chart: IChartApi): void => {
        stockChartRef.current = chart;
        chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (range !== null && volumeChartRef.current !== null) {
                volumeChartRef.current
                    .timeScale()
                    .setVisibleLogicalRange(range);
            }
        });
    }, []);

    const handleVolumeChartReady = useCallback((chart: IChartApi): void => {
        volumeChartRef.current = chart;
        chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (range !== null && stockChartRef.current !== null) {
                stockChartRef.current.timeScale().setVisibleLogicalRange(range);
            }
        });
    }, []);

    return { handleStockChartReady, handleVolumeChartReady };
}
