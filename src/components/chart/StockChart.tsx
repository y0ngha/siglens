'use client';

import { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { useMAOverlay } from '@/components/chart/hooks/useMAOverlay';
import { useEMAOverlay } from '@/components/chart/hooks/useEMAOverlay';

const EMPTY_INDICATORS: IndicatorResult = {
    macd: [],
    bollinger: [],
    dmi: [],
    rsi: [],
    vwap: [],
    ma: {},
    ema: {},
};

interface StockChartProps {
    initialBars: Bar[];
    indicators?: IndicatorResult;
}

export function StockChart({
    initialBars,
    indicators = EMPTY_INDICATORS,
}: StockChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const [chartInstance, setChartInstance] = useState<IChartApi | null>(null);

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
        seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: CHART_COLORS.bullish,
            downColor: CHART_COLORS.bearish,
            borderUpColor: CHART_COLORS.bullish,
            borderDownColor: CHART_COLORS.bearish,
            wickUpColor: CHART_COLORS.bullish,
            wickDownColor: CHART_COLORS.bearish,
        });

        setChartInstance(chart);

        return () => {
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
            setChartInstance(null);
        };
    }, []);

    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;

        seriesRef.current.setData(
            initialBars.map(({ time, open, high, low, close }) => ({
                time: time as UTCTimestamp,
                open,
                high,
                low,
                close,
            }))
        );

        chartRef.current.timeScale().fitContent();
    }, [initialBars]);

    const { togglePeriod: toggleMA } = useMAOverlay({
        chart: chartInstance,
        bars: initialBars,
        indicators,
    });

    const { togglePeriod: toggleEMA } = useEMAOverlay({
        chart: chartInstance,
        bars: initialBars,
        indicators,
    });

    void toggleMA;
    void toggleEMA;

    return <div ref={containerRef} className="h-full w-full" />;
}
