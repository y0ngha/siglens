'use client';

import { useEffect, useRef } from 'react';
import { HistogramSeries, createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/chartColors';
import type { Bar } from '@/domain/types';

interface VolumeChartProps {
    bars: Bar[];
    /** 차트 인스턴스가 준비되면 호출된다. 캔들차트와 visible range 동기화에 사용된다. */
    onChartReady?: (chart: IChartApi) => void;
    /** 차트가 제거되기 직전에 호출된다. 구독 해제에 사용된다. */
    onChartRemove?: () => void;
}

export function VolumeChart({ bars, onChartReady, onChartRemove }: VolumeChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
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
        seriesRef.current = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
        });

        onChartReadyRef.current?.(chart);

        return () => {
            onChartRemoveRef.current?.();
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;

        if (bars.length === 0) {
            seriesRef.current.setData([]);
            return;
        }

        seriesRef.current.setData(
            bars.map(({ time, open, close, volume }) => ({
                time: time as UTCTimestamp,
                value: volume,
                color:
                    close >= open
                        ? CHART_COLORS.volumeBullish
                        : CHART_COLORS.volumeBearish,
            }))
        );

        chartRef.current.timeScale().fitContent();
    }, [bars]);

    return <div ref={containerRef} className="h-full w-full" />;
}
