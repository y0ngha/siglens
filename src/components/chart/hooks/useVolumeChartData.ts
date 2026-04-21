'use client';

import { type RefObject, useEffect } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { Bar, BuySellVolumeResult } from '@/domain/types';

interface UseVolumeChartDataOptions {
    chartRef: RefObject<IChartApi | null>;
    totalSeriesRef: RefObject<ISeriesApi<'Histogram'> | null>;
    buySeriesRef: RefObject<ISeriesApi<'Histogram'> | null>;
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
}

export function useVolumeChartData({
    chartRef,
    totalSeriesRef,
    buySeriesRef,
    bars,
    buySellVolume,
}: UseVolumeChartDataOptions): void {
    useEffect(() => {
        if (
            !totalSeriesRef.current ||
            !buySeriesRef.current ||
            !chartRef.current
        )
            return;

        if (bars.length === 0 || buySellVolume.length === 0) {
            totalSeriesRef.current.setData([]);
            buySeriesRef.current.setData([]);
            return;
        }

        totalSeriesRef.current.setData(
            bars.map(({ time, volume }) => ({
                time: time as UTCTimestamp,
                value: volume,
            }))
        );

        buySeriesRef.current.setData(
            bars.map(({ time }, i) => ({
                time: time as UTCTimestamp,
                // bars and buySellVolume are guaranteed same length by infrastructure layer
                value: buySellVolume[i]!.buyVolume,
            }))
        );

        chartRef.current.timeScale().fitContent();
    }, [bars, buySellVolume, chartRef, totalSeriesRef, buySeriesRef]);
}
