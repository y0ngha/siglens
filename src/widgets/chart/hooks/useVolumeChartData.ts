'use client';

import { type RefObject, useEffect } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { tailAligned } from '../utils/seriesDataUtils';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';

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

        // 정렬 규약은 `tailAligned`가 소유한다. 예전 주석은 "인프라 계층이 길이를
        // 보장한다"였는데, RSC seed가 지표를 축소해 보내면서 그 전제가 깨졌다
        // (`getSeedBarsStatic`). 좌측 정렬 + non-null 단언 조합은 길이가 어긋나면
        // `undefined.buyVolume`으로 **throw**했다 — 사이에 ErrorBoundary가 없어
        // 차트가 통째로 빈다.
        buySeriesRef.current.setData(
            tailAligned(bars, buySellVolume).map(({ time }, i) => ({
                time: time as UTCTimestamp,
                value: buySellVolume[i]?.buyVolume ?? 0,
            }))
        );

        chartRef.current.timeScale().fitContent();
    }, [bars, buySellVolume, chartRef, totalSeriesRef, buySeriesRef]);
}
