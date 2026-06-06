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
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type {
    Bar,
    IndicatorResult,
    ReconciledActionLineData,
    Timeframe,
    ValidatedActionPrices,
} from '@y0ngha/siglens-core';
import { getTimeFormatter } from '@/shared/lib/timeFormat';
import { useMAOverlay } from './hooks/useMAOverlay';
import { useEMAOverlay } from './hooks/useEMAOverlay';
import { useBollingerOverlay } from './hooks/useBollingerOverlay';
import { useMACDChart } from './hooks/useMACDChart';
import { useRSIChart } from './hooks/useRSIChart';
import { useDMIChart } from './hooks/useDMIChart';
import { useStochasticChart } from './hooks/useStochasticChart';
import { useStochRSIChart } from './hooks/useStochRSIChart';
import { useCCIChart } from './hooks/useCCIChart';
import { useMfiChart } from './hooks/useMfiChart';
import { useWilliamsRChart } from './hooks/useWilliamsRChart';
import { useConnorsRsiChart } from './hooks/useConnorsRsiChart';
import { useCmfChart } from './hooks/useCmfChart';
import { useBollingerPercentBChart } from './hooks/useBollingerPercentBChart';
import { useHurstChart } from './hooks/useHurstChart';
import { useVarianceRatioChart } from './hooks/useVarianceRatioChart';
import { useVolumeProfileOverlay } from './hooks/useVolumeProfileOverlay';
import { useIchimokuOverlay } from './hooks/useIchimokuOverlay';
import { useCandlePatternMarkers } from './hooks/useCandlePatternMarkers';
import { useActionRecommendationOverlay } from './hooks/useActionRecommendationOverlay';
import { usePaneLabels } from './hooks/usePaneLabels';
import { useOverlayLegend } from './hooks/useOverlayLegend';
import { DEFAULT_LINE_WIDTH } from './constants';
import { useIndicatorVisibility } from './hooks/useIndicatorVisibility';
import { OverlayLegend } from './OverlayLegend';
import { buildPaneLabels } from './utils/paneLabelUtils';
import { buildOverlayLabelConfigs } from './utils/overlayLabelUtils';
import {
    EMA_DEFAULT_PERIODS,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@y0ngha/siglens-core';
import { IndicatorSettingsModal } from './ui/IndicatorSettingsModal';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from './model/indicatorRegistry';

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
    /** aria-label에 들어갈 ticker — 스크린 리더에 차트 종목 안내. 없으면 generic label로 fallback. */
    ticker?: string;
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
    ticker,
}: StockChartProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', UTCTimestamp> | null>(
        null
    );
    const onChartReadyRef = useRef(onChartReady);
    const onChartRemoveRef = useRef(onChartRemove);
    // paneIndices effect의 첫 mount skip 마커 (아래 useEffect 참조).
    const isInitialPaneRenderRef = useRef(true);

    const { visible, toggle, paneIndices } = useIndicatorVisibility();

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
                // Bar.time은 number이지만 LWC setData는 UTCTimestamp(branded number)를 요구한다.
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
        isVisible: visible.rsi,
        paneIndex: paneIndices.rsi,
    });

    useMACDChart({
        ...commonHookParams,
        isVisible: visible.macd,
        paneIndex: paneIndices.macd,
    });

    useDMIChart({
        ...commonHookParams,
        isVisible: visible.dmi,
        paneIndex: paneIndices.dmi,
    });

    useStochasticChart({
        ...commonHookParams,
        isVisible: visible.stochastic,
        paneIndex: paneIndices.stochastic,
    });

    useStochRSIChart({
        ...commonHookParams,
        isVisible: visible.stochRsi,
        paneIndex: paneIndices.stochRsi,
    });

    useCCIChart({
        ...commonHookParams,
        isVisible: visible.cci,
        paneIndex: paneIndices.cci,
    });

    useMfiChart({
        ...commonHookParams,
        isVisible: visible.mfi,
        paneIndex: paneIndices.mfi,
    });

    useWilliamsRChart({
        ...commonHookParams,
        isVisible: visible.williamsR,
        paneIndex: paneIndices.williamsR,
    });

    useConnorsRsiChart({
        ...commonHookParams,
        isVisible: visible.connorsRsi,
        paneIndex: paneIndices.connorsRsi,
    });

    useCmfChart({
        ...commonHookParams,
        isVisible: visible.cmf,
        paneIndex: paneIndices.cmf,
    });

    useBollingerPercentBChart({
        ...commonHookParams,
        isVisible: visible.bollingerPercentB,
        paneIndex: paneIndices.bollingerPercentB,
    });

    useHurstChart({
        ...commonHookParams,
        isVisible: visible.hurst,
        paneIndex: paneIndices.hurst,
    });

    useVarianceRatioChart({
        ...commonHookParams,
        isVisible: visible.varianceRatio,
        paneIndex: paneIndices.varianceRatio,
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
    // 단, 첫 mount에서는 이 명시 resize를 skip한다 (`isInitialPaneRenderRef`) — hydration /
    // 첫 진입 시 layout 안정화 전에 wrapper.clientHeight를 측정하면 작은 값(예: 30px)이
    // 그대로 chart에 박혀 viewport 잔여 size를 무시한 작은 차트로 그려진다. 첫 mount의
    // sizing은 createChart의 autoSize ResizeObserver에 위임하고, 사용자 indicator 토글로
    // paneIndices가 실제 변경된 이후부터만 명시 resize를 호출한다.
    useEffect(() => {
        if (isInitialPaneRenderRef.current) {
            isInitialPaneRenderRef.current = false;
            return;
        }
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

    const indicatorBindings = useMemo<IndicatorBinding[]>(
        () => [
            {
                meta: INDICATOR_META.ma,
                active: maVisiblePeriods.length > 0,
                availablePeriods: MA_DEFAULT_PERIODS,
                visiblePeriods: maVisiblePeriods,
                onTogglePeriod: toggleMAPeriod,
            },
            {
                meta: INDICATOR_META.ema,
                active: emaVisiblePeriods.length > 0,
                availablePeriods: EMA_DEFAULT_PERIODS,
                visiblePeriods: emaVisiblePeriods,
                onTogglePeriod: toggleEMAPeriod,
            },
            {
                meta: INDICATOR_META.ichimoku,
                active: ichimokuVisible,
                onToggle: toggleIchimoku,
            },
            {
                meta: INDICATOR_META.rsi,
                active: visible.rsi,
                onToggle: () => toggle('rsi'),
            },
            {
                meta: INDICATOR_META.macd,
                active: visible.macd,
                onToggle: () => toggle('macd'),
            },
            {
                meta: INDICATOR_META.dmi,
                active: visible.dmi,
                onToggle: () => toggle('dmi'),
            },
            {
                meta: INDICATOR_META.stochastic,
                active: visible.stochastic,
                onToggle: () => toggle('stochastic'),
            },
            {
                meta: INDICATOR_META.stochRsi,
                active: visible.stochRsi,
                onToggle: () => toggle('stochRsi'),
            },
            {
                meta: INDICATOR_META.cci,
                active: visible.cci,
                onToggle: () => toggle('cci'),
            },
            {
                meta: INDICATOR_META.bollinger,
                active: bollingerVisible,
                onToggle: toggleBollinger,
            },
            {
                meta: INDICATOR_META.volumeProfile,
                active: vpVisible,
                onToggle: toggleVP,
            },
            {
                meta: INDICATOR_META.mfi,
                active: visible.mfi,
                onToggle: () => toggle('mfi'),
            },
            {
                meta: INDICATOR_META.williamsR,
                active: visible.williamsR,
                onToggle: () => toggle('williamsR'),
            },
            {
                meta: INDICATOR_META.connorsRsi,
                active: visible.connorsRsi,
                onToggle: () => toggle('connorsRsi'),
            },
            {
                meta: INDICATOR_META.cmf,
                active: visible.cmf,
                onToggle: () => toggle('cmf'),
            },
            {
                meta: INDICATOR_META.bollingerPercentB,
                active: visible.bollingerPercentB,
                onToggle: () => toggle('bollingerPercentB'),
            },
            {
                meta: INDICATOR_META.hurst,
                active: visible.hurst,
                onToggle: () => toggle('hurst'),
            },
            {
                meta: INDICATOR_META.varianceRatio,
                active: visible.varianceRatio,
                onToggle: () => toggle('varianceRatio'),
            },
        ],
        [
            maVisiblePeriods,
            emaVisiblePeriods,
            ichimokuVisible,
            visible,
            toggle,
            bollingerVisible,
            vpVisible,
            toggleMAPeriod,
            toggleEMAPeriod,
            toggleIchimoku,
            toggleBollinger,
            toggleVP,
        ]
    );

    if (bars.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p className="text-secondary-500 text-sm">
                    차트 데이터가 없습니다
                </p>
            </div>
        );
    }

    // Lightweight Charts 캔버스 자체는 스크린 리더가 읽을 수 없으므로 캔버스 컨테이너에
    // role/aria-label을 부여한다. wrapperRef에 붙이면 자식으로 들어가는 IndicatorSettingsModal·
    // OverlayLegend의 인터랙티브 요소가 일부 스크린리더에서 presentational로 취급될 수 있어
    // 캔버스만 들어가는 containerRef에 둔다.
    const chartAriaLabel =
        ticker !== undefined && ticker !== ''
            ? `${ticker} ${timeframe} 캔들 차트`
            : '가격 차트';

    return (
        <div ref={wrapperRef} className="relative h-full w-full">
            <div
                ref={containerRef}
                className="h-full w-full"
                role="img"
                aria-label={chartAriaLabel}
            />
            <div className="absolute top-2 right-2 z-10">
                <IndicatorSettingsModal bindings={indicatorBindings} />
            </div>
            <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-1">
                <OverlayLegend items={overlayLegendItems} />
            </div>
        </div>
    );
}
