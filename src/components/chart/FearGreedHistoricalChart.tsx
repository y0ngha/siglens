'use client';

import { useEffect, useRef } from 'react';
import {
    createChart,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type Time,
} from 'lightweight-charts';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/lib/chartColors';

interface FearGreedHistoricalChartProps {
    history: FearGreedHistoryPoint[];
}

const CHART_HEIGHT = 240;
const LINE_COLOR = CHART_COLORS.actionEntry; // primary-400 (#60a5fa)
const LINE_WIDTH = 2;

/**
 * 1-year fearGreed score line chart. Warm-up entries (`score === null`) are
 * filtered out — the time series will naturally show gaps where the algorithm
 * is below confidence threshold.
 *
 * Uses lightweight-charts v5 API (`chart.addSeries(LineSeries, ...)`) and
 * `autoSize: true` for resize handling, matching the existing chart pattern
 * in `useVolumeChartLifecycle`.
 */
export function FearGreedHistoricalChart({
    history,
}: FearGreedHistoricalChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const chart = createChart(containerRef.current, {
            height: CHART_HEIGHT,
            autoSize: true,
            layout: {
                background: { color: 'transparent' },
                textColor: CHART_COLORS.text,
            },
            grid: {
                vertLines: { color: CHART_COLORS.grid },
                horzLines: { color: CHART_COLORS.grid },
            },
            timeScale: { borderVisible: false },
            rightPriceScale: { borderVisible: false },
        });
        const series = chart.addSeries(LineSeries, {
            color: LINE_COLOR,
            lineWidth: LINE_WIDTH,
        });
        chartRef.current = chart;
        seriesRef.current = series;
        return () => {
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const series = seriesRef.current;
        if (!series) return;
        const data: LineData[] = history
            .filter(
                (p): p is FearGreedHistoryPoint & { score: number } =>
                    p.score !== null
            )
            .map(p => ({
                // FearGreedHistoryPoint.date는 항상 'YYYY-MM-DD' 형식 — lightweight-charts Time(string) 계약 충족.
                time: p.date as Time,
                value: p.score,
            }));
        series.setData(data);
        chartRef.current?.timeScale().fitContent();
    }, [history]);

    return (
        <div
            ref={containerRef}
            className="w-full"
            role="img"
            aria-label="최근 1년 공포·탐욕 지수 추이 차트"
        />
    );
}
