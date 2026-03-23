'use client';

import { useEffect, useRef } from 'react';
import { HistogramSeries, createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar } from '@/domain/types';

interface VolumeChartProps {
    bars: Bar[];
}

export function VolumeChart({ bars }: VolumeChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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
        seriesRef.current = chart.addSeries(
            HistogramSeries,
            { priceFormat: { type: 'volume' } }
        );

        return () => {
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;

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
