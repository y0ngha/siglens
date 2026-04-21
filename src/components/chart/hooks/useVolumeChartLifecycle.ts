'use client';

import { type RefObject, useEffect, useRef } from 'react';
import {
    createChart,
    HistogramSeries,
    type IChartApi,
    type ISeriesApi,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/chartColors';

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

        const chart = createChart(containerRef.current, {
            autoSize: true,
            layout: {
                background: { color: CHART_COLORS.background },
                textColor: CHART_COLORS.text,
            },
            grid: {
                vertLines: { color: CHART_COLORS.grid },
                horzLines: { color: CHART_COLORS.grid },
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
