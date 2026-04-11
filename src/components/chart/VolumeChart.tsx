'use client';

import { useEffect, useRef } from 'react';
import { HistogramSeries, createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/chartColors';
import type { Bar, BuySellVolumeResult } from '@/domain/types';

interface VolumeChartProps {
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
    /** 차트 인스턴스가 준비되면 호출된다. 캔들차트와 visible range 동기화에 사용된다. */
    onChartReady?: (chart: IChartApi) => void;
    /** 차트가 제거되기 직전에 호출된다. 구독 해제에 사용된다. */
    onChartRemove?: () => void;
}

export function VolumeChart({
    bars,
    buySellVolume,
    onChartReady,
    onChartRemove,
}: VolumeChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
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

        // Total volume (red, background)
        totalSeriesRef.current = chart.addSeries(HistogramSeries, {
            color: CHART_COLORS.volumeBearish,
            priceFormat: { type: 'volume' },
        });

        // Buy volume (teal, overlay)
        buySeriesRef.current = chart.addSeries(HistogramSeries, {
            color: CHART_COLORS.volumeBullish,
            priceFormat: { type: 'volume' },
        });

        onChartReadyRef.current?.(chart);

        return () => {
            onChartRemoveRef.current?.();
            chart.remove();
            chartRef.current = null;
            totalSeriesRef.current = null;
            buySeriesRef.current = null;
        };
    }, []);

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
                value: buySellVolume[i]!.buyVolume,
            }))
        );

        chartRef.current.timeScale().fitContent();
    }, [bars, buySellVolume]);

    return <div ref={containerRef} className="h-full w-full" />;
}
