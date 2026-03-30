'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult, PatternResult } from '@/domain/types';
import { useMAOverlay } from '@/components/chart/hooks/useMAOverlay';
import { useEMAOverlay } from '@/components/chart/hooks/useEMAOverlay';
import { useBollingerOverlay } from '@/components/chart/hooks/useBollingerOverlay';
import { useMACDChart } from '@/components/chart/hooks/useMACDChart';
import { useRSIChart } from '@/components/chart/hooks/useRSIChart';
import { useDMIChart } from '@/components/chart/hooks/useDMIChart';
import { usePatternOverlay } from '@/components/chart/hooks/usePatternOverlay';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { IndicatorToolbar } from '@/components/chart/IndicatorToolbar';
import {
    MA_DEFAULT_PERIODS,
    EMA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';

interface CommonHookParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth: LineWidth;
}

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

    const commonHookParams: CommonHookParams = {
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH,
    };

    const { visiblePeriods: maVisiblePeriods, togglePeriod: toggleMAPeriod } =
        useMAOverlay(commonHookParams);

    const { visiblePeriods: emaVisiblePeriods, togglePeriod: toggleEMAPeriod } =
        useEMAOverlay(commonHookParams);

    const { isVisible: bollingerVisible, toggle: toggleBollinger } =
        useBollingerOverlay(commonHookParams);

    const { isVisible: macdVisible, toggle: toggleMACD } =
        useMACDChart(commonHookParams);

    const { isVisible: rsiVisible, toggle: toggleRSI } =
        useRSIChart(commonHookParams);

    const { isVisible: dmiVisible, toggle: toggleDMI } =
        useDMIChart(commonHookParams);

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

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />
            <div className="absolute top-2 left-2 z-10">
                <IndicatorToolbar
                    maVisiblePeriods={maVisiblePeriods}
                    maAvailablePeriods={MA_DEFAULT_PERIODS}
                    onMAToggle={toggleMAPeriod}
                    emaVisiblePeriods={emaVisiblePeriods}
                    emaAvailablePeriods={EMA_DEFAULT_PERIODS}
                    onEMAToggle={toggleEMAPeriod}
                    bollinger={{
                        visible: bollingerVisible,
                        onToggle: toggleBollinger,
                    }}
                    macd={{ visible: macdVisible, onToggle: toggleMACD }}
                    rsi={{ visible: rsiVisible, onToggle: toggleRSI }}
                    dmi={{ visible: dmiVisible, onToggle: toggleDMI }}
                />
            </div>
        </div>
    );
}
