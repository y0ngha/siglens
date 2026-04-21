'use client';

import type { RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/chartColors';
import type {
    Bar,
    IndicatorResult,
    Timeframe,
    ValidatedActionPrices,
} from '@/domain/types';
import { getTimeFormatter } from '@/domain/chart/timeFormat';
import { useMAOverlay } from '@/components/chart/hooks/useMAOverlay';
import { useEMAOverlay } from '@/components/chart/hooks/useEMAOverlay';
import { useBollingerOverlay } from '@/components/chart/hooks/useBollingerOverlay';
import { useMACDChart } from '@/components/chart/hooks/useMACDChart';
import { useRSIChart } from '@/components/chart/hooks/useRSIChart';
import { useDMIChart } from '@/components/chart/hooks/useDMIChart';
import { useStochasticChart } from '@/components/chart/hooks/useStochasticChart';
import { useStochRSIChart } from '@/components/chart/hooks/useStochRSIChart';
import { useCCIChart } from '@/components/chart/hooks/useCCIChart';
import { useVolumeProfileOverlay } from '@/components/chart/hooks/useVolumeProfileOverlay';
import { useIchimokuOverlay } from '@/components/chart/hooks/useIchimokuOverlay';
import { useCandlePatternMarkers } from '@/components/chart/hooks/useCandlePatternMarkers';
import { useActionRecommendationOverlay } from '@/components/chart/hooks/useActionRecommendationOverlay';
import type { ReconciledActionLineData } from '@/domain/types';
import { usePaneLabels } from '@/components/chart/hooks/usePaneLabels';
import { useOverlayLegend } from '@/components/chart/hooks/useOverlayLegend';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { useIndicatorVisibility } from '@/components/chart/hooks/useIndicatorVisibility';
import { OverlayLegend } from '@/components/chart/OverlayLegend';
import { buildPaneLabels } from '@/components/chart/utils/paneLabelUtils';
import { buildOverlayLabelConfigs } from '@/components/chart/utils/overlayLabelUtils';
import {
    EMA_DEFAULT_PERIODS,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';
import { IndicatorToolbar } from '@/components/chart/IndicatorToolbar';

interface CommonHookParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth: LineWidth;
}

interface StockChartProps {
    bars: Bar[];
    timeframe: Timeframe;
    indicators?: IndicatorResult;
    actionPrices?: ValidatedActionPrices;
    reconciledActionPrices?: ReconciledActionLineData;
    actionPricesVisible?: boolean;
    /** 차트 인스턴스가 준비되면 호출된다. 거래량 차트와 visible range 동기화에 사용된다. */
    onChartReady?: (chart: IChartApi) => void;
    /** 차트가 제거되기 직전에 호출된다. 구독 해제에 사용된다. */
    onChartRemove?: () => void;
}

export function StockChart({
    bars,
    timeframe,
    indicators = EMPTY_INDICATOR_RESULT,
    actionPrices,
    reconciledActionPrices,
    actionPricesVisible = true,
    onChartReady,
    onChartRemove,
}: StockChartProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', UTCTimestamp> | null>(
        null
    );
    const onChartReadyRef = useRef(onChartReady);
    const onChartRemoveRef = useRef(onChartRemove);

    const {
        rsiVisible,
        macdVisible,
        dmiVisible,
        stochasticVisible,
        stochRsiVisible,
        cciVisible,
        toggleRSI,
        toggleMACD,
        toggleDMI,
        toggleStochastic,
        toggleStochRSI,
        toggleCCI,
        paneIndices,
    } = useIndicatorVisibility();

    const commonHookParams: CommonHookParams = {
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH,
    };

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
        seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: CHART_COLORS.bullish,
            downColor: CHART_COLORS.bearish,
            borderUpColor: CHART_COLORS.bullish,
            borderDownColor: CHART_COLORS.bearish,
            wickUpColor: CHART_COLORS.bullish,
            wickDownColor: CHART_COLORS.bearish,
            // LWC addSeries() 반환 타입에 UTCTimestamp 제네릭이 없어 타입 가드 불가 — 라이브러리 타입 한계.
        }) as ISeriesApi<'Candlestick', UTCTimestamp>;

        onChartReadyRef.current?.(chart);

        return () => {
            onChartRemoveRef.current?.();
            // autoSize 해제 후 remove — LWC ResizeObserver가 disposed 객체에 접근하는 에러 방지.
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!chartRef.current) return;

        chartRef.current.applyOptions({
            localization: {
                timeFormatter: getTimeFormatter(timeframe),
            },
        });
    }, [timeframe]);

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

    const { visiblePeriods: maVisiblePeriods, togglePeriod: toggleMAPeriod } =
        useMAOverlay(commonHookParams);

    const { visiblePeriods: emaVisiblePeriods, togglePeriod: toggleEMAPeriod } =
        useEMAOverlay(commonHookParams);

    const { isVisible: bollingerVisible, toggle: toggleBollinger } =
        useBollingerOverlay(commonHookParams);

    const { isVisible: vpVisible, toggle: toggleVP } =
        useVolumeProfileOverlay(commonHookParams);

    const { isVisible: ichimokuVisible, toggle: toggleIchimoku } =
        useIchimokuOverlay(commonHookParams);

    useRSIChart({
        ...commonHookParams,
        isVisible: rsiVisible,
        paneIndex: paneIndices.rsi,
    });

    useMACDChart({
        ...commonHookParams,
        isVisible: macdVisible,
        paneIndex: paneIndices.macd,
    });

    useDMIChart({
        ...commonHookParams,
        isVisible: dmiVisible,
        paneIndex: paneIndices.dmi,
    });

    useStochasticChart({
        ...commonHookParams,
        isVisible: stochasticVisible,
        paneIndex: paneIndices.stochastic,
    });

    useStochRSIChart({
        ...commonHookParams,
        isVisible: stochRsiVisible,
        paneIndex: paneIndices.stochRsi,
    });

    useCCIChart({
        ...commonHookParams,
        isVisible: cciVisible,
        paneIndex: paneIndices.cci,
    });

    useCandlePatternMarkers({ seriesRef, bars });

    useActionRecommendationOverlay({
        seriesRef,
        actionPrices,
        reconciledPrices: reconciledActionPrices,
        isVisible: actionPricesVisible,
        lineWidth: DEFAULT_LINE_WIDTH,
    });

    // indicator 제거 시 LWC v5가 빈 pane DOM을 정리하지 않아 autoSize 토글로 layout invalidate를 강제한다.
    useEffect(() => {
        const chart = chartRef.current;
        const wrapper = wrapperRef.current;
        if (!chart || !wrapper) return;

        const rafId = requestAnimationFrame(() => {
            const currentChart = chartRef.current;
            const currentWrapper = wrapperRef.current;
            if (!currentChart || !currentWrapper) return;

            const { clientWidth, clientHeight } = currentWrapper;
            if (clientWidth === 0 || clientHeight === 0) return;

            currentChart.applyOptions({ autoSize: false });
            currentChart.resize(clientWidth - 1, clientHeight);
            currentChart.resize(clientWidth, clientHeight);
            currentChart.applyOptions({ autoSize: true });
            currentChart.timeScale().fitContent();
        });

        return () => cancelAnimationFrame(rafId);
    }, [paneIndices]);

    const overlayLabelConfigs = useMemo(
        () =>
            buildOverlayLabelConfigs({
                maVisiblePeriods,
                emaVisiblePeriods,
                bollingerVisible,
                ichimokuVisible,
                vpVisible,
            }),
        [
            maVisiblePeriods,
            emaVisiblePeriods,
            bollingerVisible,
            ichimokuVisible,
            vpVisible,
        ]
    );

    const overlayLegendItems = useOverlayLegend({
        chartRef,
        bars,
        indicators,
        labelConfigs: overlayLabelConfigs,
    });

    const paneLabels = useMemo(
        () => buildPaneLabels(paneIndices),
        [paneIndices]
    );

    usePaneLabels({
        chartRef,
        containerRef: wrapperRef,
        labels: paneLabels,
    });

    if (bars.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p className="text-secondary-500 text-sm">
                    차트 데이터가 없습니다
                </p>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />
            <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-1">
                <div className="pointer-events-auto">
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
                        stochastic={{
                            visible: stochasticVisible,
                            onToggle: toggleStochastic,
                        }}
                        stochRsi={{
                            visible: stochRsiVisible,
                            onToggle: toggleStochRSI,
                        }}
                        cci={{ visible: cciVisible, onToggle: toggleCCI }}
                        volumeProfile={{
                            visible: vpVisible,
                            onToggle: toggleVP,
                        }}
                        ichimoku={{
                            visible: ichimokuVisible,
                            onToggle: toggleIchimoku,
                        }}
                    />
                </div>
                <OverlayLegend items={overlayLegendItems} />
            </div>
        </div>
    );
}
