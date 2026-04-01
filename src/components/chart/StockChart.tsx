'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from 'react';
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
import type { PaneIndices } from '@/components/chart/types';
import { useMAOverlay } from '@/components/chart/hooks/useMAOverlay';
import { useEMAOverlay } from '@/components/chart/hooks/useEMAOverlay';
import { useBollingerOverlay } from '@/components/chart/hooks/useBollingerOverlay';
import { useMACDChart } from '@/components/chart/hooks/useMACDChart';
import { useRSIChart } from '@/components/chart/hooks/useRSIChart';
import { useDMIChart } from '@/components/chart/hooks/useDMIChart';
import { usePatternOverlay } from '@/components/chart/hooks/usePatternOverlay';
import { useCandlePatternMarkers } from '@/components/chart/hooks/useCandlePatternMarkers';
import { usePaneLabels } from '@/components/chart/hooks/usePaneLabels';
import {
    DEFAULT_LINE_WIDTH,
    INACTIVE_PANE_INDEX,
} from '@/components/chart/constants';
import { IndicatorToolbar } from '@/components/chart/IndicatorToolbar';
import { buildPaneLabels } from '@/components/chart/utils/paneLabelUtils';
import {
    MA_DEFAULT_PERIODS,
    EMA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';

const CANDLESTICK_PANE_INDEX = 0;
const FIRST_INDICATOR_PANE_INDEX = 1;

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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    const [rsiVisible, setRsiVisible] = useState(false);
    const [macdVisible, setMacdVisible] = useState(false);
    const [dmiVisible, setDmiVisible] = useState(false);

    const toggleRSI = useCallback(() => {
        setRsiVisible(prev => !prev);
    }, []);

    const toggleMACD = useCallback(() => {
        setMacdVisible(prev => !prev);
    }, []);

    const toggleDMI = useCallback(() => {
        setDmiVisible(prev => !prev);
    }, []);

    const paneIndices: PaneIndices = useMemo(() => {
        let next = FIRST_INDICATOR_PANE_INDEX;

        return {
            rsi: rsiVisible ? next++ : INACTIVE_PANE_INDEX,
            macd: macdVisible ? next++ : INACTIVE_PANE_INDEX,
            dmi: dmiVisible ? next++ : INACTIVE_PANE_INDEX,
        };
    }, [rsiVisible, macdVisible, dmiVisible]);

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

    useMACDChart({
        ...commonHookParams,
        isVisible: macdVisible,
        paneIndex: paneIndices.macd,
    });

    useRSIChart({
        ...commonHookParams,
        isVisible: rsiVisible,
        paneIndex: paneIndices.rsi,
    });

    useDMIChart({
        ...commonHookParams,
        isVisible: dmiVisible,
        paneIndex: paneIndices.dmi,
    });

    const { isVisible: candlePatternsVisible, toggle: toggleCandlePatterns } =
        useCandlePatternMarkers({ seriesRef, bars });

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

    const paneLabels = useMemo(
        () =>
            buildPaneLabels({
                rsiVisible,
                macdVisible,
                dmiVisible,
                paneIndices,
            }),
        [rsiVisible, macdVisible, dmiVisible, paneIndices]
    );

    usePaneLabels({
        chartRef,
        containerRef: wrapperRef,
        labels: paneLabels,
    });

    // 빈 pane 정리: indicator가 꺼지면 남은 빈 pane을 역순으로 제거
    // pane 0(캔들스틱)은 보호
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const activePaneCount =
            [rsiVisible, macdVisible, dmiVisible].filter(Boolean).length +
            FIRST_INDICATOR_PANE_INDEX;

        const panes = chart.panes();

        for (
            let i = panes.length - 1;
            i >= activePaneCount && i > CANDLESTICK_PANE_INDEX;
            i--
        ) {
            chart.removePane(i);
        }
    }, [rsiVisible, macdVisible, dmiVisible]);

    return (
        <div ref={wrapperRef} className="relative h-full w-full">
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
                    candlePatterns={{
                        visible: candlePatternsVisible,
                        onToggle: toggleCandlePatterns,
                    }}
                />
            </div>
        </div>
    );
}
