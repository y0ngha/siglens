'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    KeyLevels,
    PatternResult,
    Timeframe,
    Trendline,
} from '@/domain/types';
import { getTimeFormatter } from '@/domain/chart/timeFormat';
import type { PaneIndices } from '@/components/chart/types';
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
import { usePaneLabels } from '@/components/chart/hooks/usePaneLabels';
import { useOverlayLegend } from '@/components/chart/hooks/useOverlayLegend';
import {
    DEFAULT_LINE_WIDTH,
    INACTIVE_PANE_INDEX,
} from '@/components/chart/constants';
import { IndicatorToolbar } from '@/components/chart/IndicatorToolbar';
import { OverlayLegend } from '@/components/chart/OverlayLegend';
import { buildPaneLabels } from '@/components/chart/utils/paneLabelUtils';
import { buildOverlayLabelConfigs } from '@/components/chart/utils/overlayLabelUtils';
import {
    EMA_DEFAULT_PERIODS,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@/domain/indicators/constants';

const CANDLESTICK_PANE_INDEX = 0;
const FIRST_INDICATOR_PANE_INDEX = 1;
const EMPTY_KEY_LEVELS: KeyLevels = { support: [], resistance: [] };

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
    patterns?: PatternResult[];
    trendlines?: Trendline[];
    trendlinesVisible?: boolean;
    keyLevels?: KeyLevels;
    keyLevelsVisible?: boolean;
    onPatternOverlayChange?: (
        visiblePatterns: Set<string>,
        togglePattern: (patternName: string) => void
    ) => void;
}

export function StockChart({
    bars,
    timeframe,
    indicators = EMPTY_INDICATOR_RESULT,
    /**
     * TODO 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
     */
    patterns = [],
    trendlines = [],
    trendlinesVisible = false,
    keyLevels = EMPTY_KEY_LEVELS,
    keyLevelsVisible = false,
    onPatternOverlayChange,
}: StockChartProps) {
    const [rsiVisible, setRsiVisible] = useState(false);
    const [macdVisible, setMacdVisible] = useState(false);
    const [dmiVisible, setDmiVisible] = useState(false);
    const [stochasticVisible, setStochasticVisible] = useState(false);
    const [stochRsiVisible, setStochRsiVisible] = useState(false);
    const [cciVisible, setCciVisible] = useState(false);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', UTCTimestamp> | null>(
        null
    );

    const paneIndices: PaneIndices = useMemo(() => {
        const visibles = [
            rsiVisible,
            macdVisible,
            dmiVisible,
            stochasticVisible,
            stochRsiVisible,
            cciVisible,
        ];
        const indexFor = (pos: number): number => {
            const precedingActive = visibles
                .slice(0, pos)
                .filter(Boolean).length;
            return visibles[pos]
                ? FIRST_INDICATOR_PANE_INDEX + precedingActive
                : INACTIVE_PANE_INDEX;
        };
        return {
            rsi: indexFor(0),
            macd: indexFor(1),
            dmi: indexFor(2),
            stochastic: indexFor(3),
            stochRsi: indexFor(4),
            cci: indexFor(5),
        };
    }, [
        rsiVisible,
        macdVisible,
        dmiVisible,
        stochasticVisible,
        stochRsiVisible,
        cciVisible,
    ]);

    const toggleRSI = useCallback(() => {
        setRsiVisible(prev => !prev);
    }, []);

    const toggleMACD = useCallback(() => {
        setMacdVisible(prev => !prev);
    }, []);

    const toggleDMI = useCallback(() => {
        setDmiVisible(prev => !prev);
    }, []);

    const toggleStochastic = useCallback(() => {
        setStochasticVisible(prev => !prev);
    }, []);

    const toggleStochRSI = useCallback(() => {
        setStochRsiVisible(prev => !prev);
    }, []);

    const toggleCCI = useCallback(() => {
        setCciVisible(prev => !prev);
    }, []);

    const commonHookParams: CommonHookParams = {
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH,
    };

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
            // lightweight-charts의 addSeries() 반환 타입에 UTCTimestamp 제네릭이 포함되지 않아
            // 타입 가드로 narrowing이 불가능하다. 라이브러리 타입 한계로 인한 assertion이다.
        }) as ISeriesApi<'Candlestick', UTCTimestamp>;

        return () => {
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

    const { isVisible: candlePatternsVisible, toggle: toggleCandlePatterns } =
        useCandlePatternMarkers({ seriesRef, bars });

    /**
     * TODO: 선 그리는 부분에 대해서는 오류가 많아 잠시 주석처리
     */

    // const { visiblePatterns, togglePattern } = usePatternOverlay({
    //     chartRef,
    //     seriesRef,
    //     bars,
    //     patterns,
    // });
    //
    // useTrendlineOverlay({
    //     chartRef,
    //     bars,
    //     trendlines,
    //     isVisible: trendlinesVisible,
    // });
    //
    // useKeyLevelsOverlay({
    //     chartRef,
    //     bars,
    //     keyLevels,
    //     isVisible: keyLevelsVisible,
    //     lineWidth: DEFAULT_LINE_WIDTH,
    // });

    // LWC DOM 레이아웃 강제 갱신
    // indicator hook의 removeSeries 후 LWC가 빈 pane을 내부적으로 제거하지만
    // DOM 레이아웃(높이 배분)을 즉시 갱신하지 않아 빈 공간이 남는다.
    // cleanup 없는 RAF로 다음 페인트 직전에 레이아웃을 강제 갱신한다.
    // cleanup이 있으면 후속 리렌더에 의해 RAF가 취소될 수 있으므로 의도적으로 생략한다.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        requestAnimationFrame(() => {
            // chart가 이미 소멸했을 수 있으므로 재확인
            if (!chartRef.current) return;
            chartRef.current.timeScale().fitContent();
        });
    }, [paneIndices]);

    /**
     * TODO: 선 그리는 부분에 대해서는 오류가 많아 잠시 주석처리
     */

    // const notifyPatternOverlayChange = useEffectEvent(() => {
    //     onPatternOverlayChange?.(visiblePatterns, togglePattern);
    // });
    //
    // useEffect(() => {
    //     notifyPatternOverlayChange();
    // }, [visiblePatterns]);

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
                {/*<div className="pointer-events-auto">*/}
                {/*<IndicatorToolbar*/}
                {/*    maVisiblePeriods={maVisiblePeriods}*/}
                {/*    maAvailablePeriods={MA_DEFAULT_PERIODS}*/}
                {/*    onMAToggle={toggleMAPeriod}*/}
                {/*    emaVisiblePeriods={emaVisiblePeriods}*/}
                {/*    emaAvailablePeriods={EMA_DEFAULT_PERIODS}*/}
                {/*    onEMAToggle={toggleEMAPeriod}*/}
                {/*    bollinger={{*/}
                {/*        visible: bollingerVisible,*/}
                {/*        onToggle: toggleBollinger,*/}
                {/*    }}*/}
                {/*    macd={{ visible: macdVisible, onToggle: toggleMACD }}*/}
                {/*    rsi={{ visible: rsiVisible, onToggle: toggleRSI }}*/}
                {/*    dmi={{ visible: dmiVisible, onToggle: toggleDMI }}*/}
                {/*    stochastic={{*/}
                {/*        visible: stochasticVisible,*/}
                {/*        onToggle: toggleStochastic,*/}
                {/*    }}*/}
                {/*    stochRsi={{*/}
                {/*        visible: stochRsiVisible,*/}
                {/*        onToggle: toggleStochRSI,*/}
                {/*    }}*/}
                {/*    cci={{ visible: cciVisible, onToggle: toggleCCI }}*/}
                {/*    volumeProfile={{*/}
                {/*        visible: vpVisible,*/}
                {/*        onToggle: toggleVP,*/}
                {/*    }}*/}
                {/*    ichimoku={{*/}
                {/*        visible: ichimokuVisible,*/}
                {/*        onToggle: toggleIchimoku,*/}
                {/*    }}*/}
                {/*    candlePatterns={{*/}
                {/*        visible: candlePatternsVisible,*/}
                {/*        onToggle: toggleCandlePatterns,*/}
                {/*    }}*/}
                {/*/>*/}
                {/*</div>*/}
                <OverlayLegend items={overlayLegendItems} />
            </div>
        </div>
    );
}
