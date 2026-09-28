'use client';

import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import {
    createChart,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface FearGreedHistoricalChartProps {
    history: FearGreedHistoryPoint[];
}

const CHART_HEIGHT = 240;
const LINE_WIDTH = 1;

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
    const t = useTranslations('widgets.chart');
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    /* 테마 전환 시 크롬만 교체(리마운트 없음). */
    /* 이 차트는 배경을 투명하게 둬 부모 카드 색을 비춘다 — 배경은 건드리지 않는다. */
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        /* 생성 시점의 테마에 맞는 크롬. 테마 전환은 마운트 지점의
           `key={themeVersion}`이 이 컴포넌트를 remount해 처리한다. */
        const chrome = getChartChrome();

        const chart = createChart(containerRef.current, {
            height: CHART_HEIGHT,
            autoSize: true,
            layout: {
                background: { color: 'transparent' },
                textColor: chrome.text,
            },
            grid: {
                vertLines: { color: chrome.grid },
                horzLines: { color: chrome.grid },
            },
            timeScale: { borderVisible: false },
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
        });
        const series = chart.addSeries(LineSeries, {
            // 상수로 빼지 않는다 — 모듈 로드 시점에 굳으면 라이트에서 옛 색이 남는다.
            color: CHART_COLORS.actionEntry,
            lineWidth: LINE_WIDTH,
            autoscaleInfoProvider: () => ({
                priceRange: { minValue: 0, maxValue: 100 },
                margins: { above: 0.1, below: 0.1 },
            }),
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
            aria-label={t('FearGreedHistoricalChart.9b98f6')}
        />
    );
}
