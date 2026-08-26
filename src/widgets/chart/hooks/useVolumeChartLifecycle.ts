'use client';

import { type RefObject, useEffect, useRef } from 'react';
import {
    createChart,
    HistogramSeries,
    type IChartApi,
    type ISeriesApi,
} from 'lightweight-charts';
import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { useChartThemeSync } from './useChartThemeSync';

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
    const themeVersion = useThemeVersion();

    /* 테마 전환 시 크롬만 교체(리마운트 없음). */
    useChartThemeSync(chartRef);
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

        /* 생성 시점의 테마에 맞는 크롬. 이후 전환은 useChartThemeSync가
           applyOptions로 처리한다(리마운트 금지 — 줌·스크롤 위치 보존). */
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
        /* `themeVersion`을 deps에 두어 테마 토글 시 차트를 다시 만든다.
       시리즈는 생성 시점의 색을 들고 있어 `applyOptions`만으로는 지표 색이
       안 바뀌고, 오버레이 훅 31개를 각각 배선하는 대신 생성 지점만 건드린다.
       로드 경로에서는 이 값이 0에서 변하지 않으므로 리마운트가 없다. */
    }, [containerRef, themeVersion]);

    return { chartRef, totalSeriesRef, buySeriesRef };
}
