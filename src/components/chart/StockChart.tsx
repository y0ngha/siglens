'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult, PatternResult } from '@/domain/types';
import { useMAOverlay } from '@/components/chart/hooks/useMAOverlay';
import { useEMAOverlay } from '@/components/chart/hooks/useEMAOverlay';
import { useBollingerOverlay } from '@/components/chart/hooks/useBollingerOverlay';
import { usePatternOverlay } from '@/components/chart/hooks/usePatternOverlay';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

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
    bars: Bar[];
    indicators?: IndicatorResult;
    patterns?: PatternResult[];
    onPatternOverlayChange?: (
        visiblePatterns: Set<string>,
        togglePattern: (patternName: string) => void
    ) => void;
}

export function StockChart({
    bars,
    indicators = EMPTY_INDICATORS,
    patterns = [],
    onPatternOverlayChange,
}: StockChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

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

        return () => {
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;

        seriesRef.current.setData(
            bars.map(({ time, open, high, low, close }) => ({
                time: time as UTCTimestamp,
                open,
                high,
                low,
                close,
            }))
        );

        chartRef.current.timeScale().fitContent();
    }, [bars]);

    useMAOverlay({
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH, // TODO: 사용자 설정으로 연결
    });
    useEMAOverlay({
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH, // TODO: 사용자 설정으로 연결
    });
    useBollingerOverlay({
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH, // TODO: 사용자 설정으로 연결
    });
    const { visiblePatterns, togglePattern } = usePatternOverlay({
        chartRef,
        bars,
        patterns,
    });

    const notifyPatternOverlayChange = useEffectEvent(() => {
        onPatternOverlayChange?.(visiblePatterns, togglePattern);
    });

    useEffect(() => {
        notifyPatternOverlayChange();
    }, [visiblePatterns]);

    return <div ref={containerRef} className="h-full w-full" />;
}
