'use client';

import { type RefObject, useEffect, useRef } from 'react';
import {
    createChart,
    HistogramSeries,
    type IChartApi,
    type ISeriesApi,
} from 'lightweight-charts';
import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';

interface UseVolumeChartLifecycleOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    onChartReady?: (chart: IChartApi) => void;
    onChartRemove?: () => void;
}

interface UseVolumeChartLifecycleReturn {
    chartRef: RefObject<IChartApi | null>;
    totalSeriesRef: RefObject<ISeriesApi<'Histogram'> | null>;
    buySeriesRef: RefObject<ISeriesApi<'Histogram'> | null>;
}

// 차트 인스턴스 생성/파기와 시리즈 등록만 담당한다. 데이터 주입은 useVolumeChartData가 전담.
export function useVolumeChartLifecycle({
    containerRef,
    onChartReady,
    onChartRemove,
}: UseVolumeChartLifecycleOptions): UseVolumeChartLifecycleReturn {
    const chartRef = useRef<IChartApi | null>(null);

    /* 테마 전환 시 크롬만 교체(리마운트 없음). */
    const totalSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const buySeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const onChartReadyRef = useRef(onChartReady);
    const onChartRemoveRef = useRef(onChartRemove);

    useEffect(() => {
        onChartReadyRef.current = onChartReady;
        onChartRemoveRef.current = onChartRemove;
    });

    useEffect(() => {
        if (!containerRef.current) return;

        /* 생성 시점의 테마에 맞는 크롬. 테마 전환은 마운트 지점의
           `key={themeVersion}`이 이 컴포넌트를 remount해 처리한다. */
        const chrome = getChartChrome();

        const chart = createChart(containerRef.current, {
            autoSize: true,
            layout: {
                background: { color: chrome.background },
                textColor: chrome.text,
            },
            grid: {
                vertLines: { color: chrome.grid },
                horzLines: { color: chrome.grid },
            },
        });

        chartRef.current = chart;

        totalSeriesRef.current = chart.addSeries(HistogramSeries, {
            color: CHART_COLORS.volumeBearish,
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        buySeriesRef.current = chart.addSeries(HistogramSeries, {
            color: CHART_COLORS.volumeBullish,
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        onChartReadyRef.current?.(chart);

        return () => {
            onChartRemoveRef.current?.();
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            totalSeriesRef.current = null;
            buySeriesRef.current = null;
        };
    }, [containerRef]);

    return { chartRef, totalSeriesRef, buySeriesRef };
}
