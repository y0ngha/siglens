'use client';

import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { INTL_LOCALE } from '@/shared/i18n/locales';

import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import type {
    Bar,
    ChartOverlay,
    IndicatorResult,
    ReconciledActionLineData,
    Timeframe,
    ValidatedActionPrices,
} from '@y0ngha/siglens-core';
import { getTimeFormatter } from '@/shared/lib/timeFormat';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import { useMAOverlay } from './hooks/useMAOverlay';
import { useEMAOverlay } from './hooks/useEMAOverlay';
import { useBollingerOverlay } from './hooks/useBollingerOverlay';
import { useKeltnerOverlay } from './hooks/useKeltnerOverlay';
import { useDonchianOverlay } from './hooks/useDonchianOverlay';
import { useSupertrendOverlay } from './hooks/useSupertrendOverlay';
import { useParabolicSarOverlay } from './hooks/useParabolicSarOverlay';
import { useChandelierOverlay } from './hooks/useChandelierOverlay';
import { useMACDChart } from './hooks/useMACDChart';
import { useLinePaneChart } from './hooks/useLinePaneChart';
import { LINE_PANE_SPECS } from './model/linePaneSpecs';
import { useDMIChart } from './hooks/useDMIChart';
import { useStochasticChart } from './hooks/useStochasticChart';
import { useStochRSIChart } from './hooks/useStochRSIChart';
import { useElderRayChart } from './hooks/useElderRayChart';
import { useSqueezeMomentumChart } from './hooks/useSqueezeMomentumChart';
import { useRegressionChart } from './hooks/useRegressionChart';
import { useVolumeProfileOverlay } from './hooks/useVolumeProfileOverlay';
import { useIchimokuOverlay } from './hooks/useIchimokuOverlay';
import { useCandlePatternMarkers } from './hooks/useCandlePatternMarkers';
import { useActionRecommendationOverlay } from './hooks/useActionRecommendationOverlay';
import { useSmcZones } from './hooks/useSmcZones';
import { usePaneLabels } from './hooks/usePaneLabels';
import { usePricePaneSize } from './hooks/usePricePaneSize';
import { usePricePaneStretch } from './hooks/usePricePaneStretch';
import { useOverlayLegend } from './hooks/useOverlayLegend';
import { DEFAULT_LINE_WIDTH, STORAGE_KEYS } from './constants';
import { useIndicatorVisibility } from './hooks/useIndicatorVisibility';
import { OverlayLegend } from './OverlayLegend';
import { buildPaneLabels } from './utils/paneLabelUtils';
import { buildOverlayLabelConfigs } from './utils/overlayLabelUtils';
import { buildCandlestickData } from './utils/candlestickDataUtils';
import {
    EMA_DEFAULT_PERIODS,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { resolvePriceDecimals } from '@/shared/lib/priceFormat';
import { IndicatorSettingsModal } from './ui/IndicatorSettingsModal';
import { ChartOverlayMenu } from './ui/ChartOverlayMenu';
import { useChartOverlays } from './hooks/useChartOverlays';
import {
    barTimesOf,
    buildOverlayLineSpecs,
    hasDrawnLevels,
    overlayColorFor,
    overlayItemKey,
} from './utils/chartOverlayUtils';
import {
    areOutcomeLabelsCrowded,
    patternLabelsByKey,
    patternPaletteByKey,
    type OverlayMenuItem,
} from './utils/overlayItems';
import { formatFibLevelLabel, type FibLevelTexts } from './utils/fibLevelLabel';
import {
    formatOutcomeLevelLabel,
    type OutcomeLevelTexts,
} from './utils/outcomeLevelLabel';
import {
    BREAKOUT_LEVEL_LABEL,
    CHART_OVERLAY_COLORS,
} from './model/chartOverlayCategories';
import {
    INDICATOR_REGISTRY,
    type IndicatorBinding,
    type IndicatorKey,
} from './model/indicatorRegistry';

const EMPTY_CHART_OVERLAYS: ChartOverlay[] = [];
const EMPTY_OVERLAY_ITEMS: readonly OverlayMenuItem[] = [];
const EMPTY_HIDDEN_KEYS: ReadonlySet<string> = new Set();
const NOOP_SET_VISIBLE = (): void => {};
const EMPTY_OVERLAY_COLORS: Record<string, string> = {};

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
    /**
     * Market profile id — drives price precision on the candlestick series.
     * Defaults to 'us-equity' (fixed 2dp) for backward compatibility.
     * Pass 'crypto' to enable dynamic-by-magnitude precision for sub-cent tokens.
     */
    marketProfile?: MarketProfileId;
    /** AI가 참조한 로직 작도(차트 작도). */
    chartOverlays?: ChartOverlay[];
    /** 패턴 오버레이의 스킬별 색 — `sourceRef → renderConfig.color`. 없으면 kind 기본색 폴백. */
    overlayColors?: Record<string, string>;
    /** "차트 작도" 메뉴에 띄울 on/off 항목(매매 가격선 포함). */
    overlayItems?: readonly OverlayMenuItem[];
    /** 꺼진 항목 key(`overlayItemKey`·`ACTION_PRICES_ITEM_KEY`). */
    hiddenOverlayKeys?: ReadonlySet<string>;
    /** AI 패널 카드·"차트 작도" 메뉴 항목 hover·focus로 강조할 항목 key. */
    highlightedOverlayKey?: string | null;
    onSetOverlayVisible?: (keys: readonly string[], visible: boolean) => void;
    /** 메뉴 항목 hover·focus로 강조를 바꾼다(`null`이면 해제). */
    onHighlightOverlay?: (key: string | null) => void;
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
    marketProfile = 'us-equity',
    chartOverlays = EMPTY_CHART_OVERLAYS,
    overlayColors = EMPTY_OVERLAY_COLORS,
    overlayItems = EMPTY_OVERLAY_ITEMS,
    hiddenOverlayKeys = EMPTY_HIDDEN_KEYS,
    highlightedOverlayKey = null,
    onSetOverlayVisible = NOOP_SET_VISIBLE,
    onHighlightOverlay,
}: StockChartProps) {
    const t = useTranslations('widgets.chart');
    const tMisc = useTranslations('shared.ui.misc');
    const locale = useResolvedLocale();
    // core의 패턴 돌파선 레벨 라벨은 언어 중립 키(`breakout`)라 여기서 문구로 바꾼다.
    // 어느 패턴의 선인지 붙인다("원형 바닥 돌파") — 패턴명을 모르면 "돌파 기준".
    const breakoutTitle = useCallback(
        (patternName: string | undefined): string =>
            patternName === undefined
                ? t('StockChart.57fdbb')
                : t('StockChart.6c577b', { v0: patternName }),
        [t]
    );
    const patternLabels = useMemo(
        () => patternLabelsByKey(overlayItems),
        [overlayItems]
    );
    // 패턴이 둘 이상이면 항목마다 팔레트 색 — 스킬 색(상승/하락/중립)만으로는 같은 방향
    // 패턴끼리 겹친다. 테마 토글은 차트를 remount하므로 마운트 시점 테마 값으로 충분하다.
    const patternPalette = useMemo(
        () =>
            patternPaletteByKey(overlayItems, [
                CHART_COLORS.overlayPattern1,
                CHART_COLORS.overlayPattern2,
                CHART_COLORS.overlayPattern3,
                CHART_COLORS.overlayPattern4,
                CHART_COLORS.overlayPattern5,
                CHART_COLORS.overlayPattern6,
            ]),
        [overlayItems]
    );
    const outcomeLabelsCrowded = useMemo(
        () => areOutcomeLabelsCrowded(overlayItems, hiddenOverlayKeys),
        [overlayItems, hiddenOverlayKeys]
    );
    // core 피보나치 레벨 라벨(`61.8%`, `ext 127.2%`, `ABC 127.2%`)의 화면 문구 —
    // 다리 방향에 따라 역할(반등·눌림·목표)로 읽히게 한다.
    const fibLevelTexts = useMemo<FibLevelTexts>(
        () => ({
            retracement: {
                down: percent => t('StockChart.87cc60', { v0: percent }),
                up: percent => t('StockChart.545536', { v0: percent }),
            },
            extension: {
                down: percent => t('StockChart.3784c9', { v0: percent }),
                up: percent => t('StockChart.693f7c', { v0: percent }),
            },
            abcExtension: {
                down: percent => t('StockChart.fd8510', { v0: percent }),
                up: percent => t('StockChart.37cc7e', { v0: percent }),
            },
        }),
        [t]
    );
    // core 무효화·목표·5파 상한 선(언어 중립 키)의 화면 문구 — 어느 패턴·엘리어트 구조의
    // 선인지 붙인다("이중천장 무효화", "삼각형 목표"). 주인을 모르면 종류만.
    const outcomeLevelTexts = useMemo<OutcomeLevelTexts>(
        () => ({
            invalidation: owner =>
                owner === undefined
                    ? t('StockChart.b7de20')
                    : t('StockChart.c70cbe', { v0: owner }),
            target: owner =>
                owner === undefined
                    ? t('StockChart.2fbea4')
                    : t('StockChart.3322f9', { v0: owner }),
            wave5Cap: owner =>
                owner === undefined
                    ? t('StockChart.b3fa71')
                    : t('StockChart.6c1313', { v0: owner }),
            elliottStructure: {
                impulse: t('StockChart.216f1f'),
                triangle: t('StockChart.6e96f3'),
                diagonal: t('StockChart.2751c7'),
                abc: 'A-B-C',
                combination: t('StockChart.a8aa4c'),
            },
        }),
        [t]
    );
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
    // mount-only 차트 생성 effect가 deps 없이([]) priceDecimals를 읽을 수 있도록 ref로 미러링.
    // effect에 priceDecimals를 deps로 추가하면 decimals 변경마다 차트가 재생성되므로 금지.
    // 초기값 2 (usEquity 고정 소수점과 일치); no-deps sync effect가 최신값으로 유지한다.
    const priceDecimalsRef = useRef<number>(2);

    const { visible, toggle, paneIndices } = useIndicatorVisibility();

    // 작도 수평 레벨 오른쪽 연장 — 분석·종목이 바뀌어도 유지되는 사용자 환경설정(localStorage).
    const [levelRightExtend, setLevelRightExtend] = usePersistentState(
        STORAGE_KEYS.levelRightExtend,
        true
    );

    const commonHookParams: CommonHookParams = {
        chartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH,
    };

    // 가격 표시 소수 자릿수 — 캔들 시리즈 priceFormat과 오버레이 범례가 공유한다.
    // descriptor가 fixed/integer면 정적, dynamic(크립토)이면 최신 종가의 크기에서
    // 유효 자릿수를 파생한다(sub-cent 토큰이 2dp로 0.00으로 뭉개지는 것 방지).
    const priceDecimals = useMemo(
        () => resolvePriceDecimals(marketProfile, bars.at(-1)?.close),
        [marketProfile, bars]
    );

    useEffect(() => {
        onChartReadyRef.current = onChartReady;
        onChartRemoveRef.current = onChartRemove;
        priceDecimalsRef.current = priceDecimals;
    });

    useEffect(() => {
        if (!containerRef.current) return;

        /* 생성 시점의 테마에 맞는 크롬. 테마 전환은 마운트 지점의
           `key={themeVersion}`이 이 컴포넌트를 통째로 remount해 처리한다. */
        const chrome = getChartChrome();

        const chart = createChart(containerRef.current, {
            autoSize: true,
            /*
             * 시간축을 그리지 않는다. 이 차트 **바로 아래**에 거래량 차트가 붙고
             * 그쪽이 자기 시간축을 그리므로, 여기까지 그리면 같은 날짜 라벨이
             * 화면에 두 번 찍힌다(실측: 각 28px, 합 56px). 축은 스택의 맨 아래
             * 하나만 두는 것이 관례이고, 여기서 28px을 돌려받아 캔들에 준다.
             *
             * `timeScale()` API 자체는 살아 있다 — `useChartSync`가 두 차트의
             * 보이는 범위를 맞추는 데 계속 쓴다. 렌더만 끈다.
             */
            timeScale: { visible: false },
            layout: {
                background: { color: chrome.background },
                textColor: chrome.text,
            },
            grid: {
                vertLines: { color: chrome.grid },
                horzLines: { color: chrome.grid },
            },
        });

        chartRef.current = chart;

        const decimals = priceDecimalsRef.current;

        seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: CHART_COLORS.bullish,
            downColor: CHART_COLORS.bearish,
            borderUpColor: CHART_COLORS.bullish,
            borderDownColor: CHART_COLORS.bearish,
            wickUpColor: CHART_COLORS.bullish,
            wickDownColor: CHART_COLORS.bearish,
            priceFormat: {
                type: 'price',
                precision: decimals,
                minMove: 10 ** -decimals,
            },
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
                // `locale`을 안 주면 `lightweight-charts`가 축 눈금을
                // `navigator.language`로 그린다 — `/en/AAPL`인데 브라우저가
                // ko-KR이면 x축이 `4월 5월`로 나온다.
                locale: INTL_LOCALE[locale],
                timeFormatter: getTimeFormatter(timeframe, locale),
            },
        });
    }, [timeframe, locale]);

    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;

        seriesRef.current.setData(
            buildCandlestickData(
                bars,
                indicators.elderImpulse,
                visible.elderImpulse
            )
        );
    }, [bars, indicators.elderImpulse, visible.elderImpulse]);

    // fitContent는 bars(데이터 로드/심볼·타임프레임 변경) 변화에만 호출 — Elder Impulse 토글로
    // setData가 재실행돼도 사용자의 줌/스크롤 상태가 초기화되지 않도록 의존성을 분리한다.
    useEffect(() => {
        chartRef.current?.timeScale().fitContent();
    }, [bars]);

    // 컴포넌트가 마운트된 채 클라이언트 사이드 심볼 탐색(예: 일반 주식 → 크립토)이 일어나면
    // mount-only effect의 priceFormat이 구식이 된다. priceDecimals 변경 시 기존 시리즈에
    // applyOptions를 적용해 sub-cent 토큰이 망가진 가격으로 표시되는 것을 방지한다.
    useEffect(() => {
        if (!seriesRef.current) return;
        seriesRef.current.applyOptions({
            priceFormat: {
                type: 'price',
                precision: priceDecimals,
                minMove: 10 ** -priceDecimals,
            },
        });
    }, [priceDecimals]);

    const { visiblePeriods: maVisiblePeriods, togglePeriod: toggleMAPeriod } =
        useMAOverlay(commonHookParams);

    const { visiblePeriods: emaVisiblePeriods, togglePeriod: toggleEMAPeriod } =
        useEMAOverlay(commonHookParams);

    const { isVisible: bollingerVisible, toggle: toggleBollinger } =
        useBollingerOverlay(commonHookParams);

    const { isVisible: keltnerVisible, toggle: toggleKeltner } =
        useKeltnerOverlay(commonHookParams);

    const { isVisible: donchianVisible, toggle: toggleDonchian } =
        useDonchianOverlay(commonHookParams);

    const { isVisible: supertrendVisible, toggle: toggleSupertrend } =
        useSupertrendOverlay(commonHookParams);

    const { isVisible: parabolicSarVisible, toggle: toggleParabolicSar } =
        useParabolicSarOverlay(commonHookParams);

    const { isVisible: chandelierVisible, toggle: toggleChandelier } =
        useChandelierOverlay(commonHookParams);

    const { isVisible: vpVisible, toggle: toggleVP } =
        useVolumeProfileOverlay(commonHookParams);

    const { isVisible: ichimokuVisible, toggle: toggleIchimoku } =
        useIchimokuOverlay(commonHookParams);

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.rsi,
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

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.cci,
        isVisible: visible.cci,
        paneIndex: paneIndices.cci,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.mfi,
        isVisible: visible.mfi,
        paneIndex: paneIndices.mfi,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.williamsR,
        isVisible: visible.williamsR,
        paneIndex: paneIndices.williamsR,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.connorsRsi,
        isVisible: visible.connorsRsi,
        paneIndex: paneIndices.connorsRsi,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.cmf,
        isVisible: visible.cmf,
        paneIndex: paneIndices.cmf,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.bollingerPercentB,
        isVisible: visible.bollingerPercentB,
        paneIndex: paneIndices.bollingerPercentB,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.hurst,
        isVisible: visible.hurst,
        paneIndex: paneIndices.hurst,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.varianceRatio,
        isVisible: visible.varianceRatio,
        paneIndex: paneIndices.varianceRatio,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.macdV,
        isVisible: visible.macdV,
        paneIndex: paneIndices.macdV,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.forceIndex,
        isVisible: visible.forceIndex,
        paneIndex: paneIndices.forceIndex,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.obv,
        isVisible: visible.obv,
        paneIndex: paneIndices.obv,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.atr,
        isVisible: visible.atr,
        paneIndex: paneIndices.atr,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.yangZhang,
        isVisible: visible.yangZhang,
        paneIndex: paneIndices.yangZhang,
    });

    useLinePaneChart({
        ...commonHookParams,
        spec: LINE_PANE_SPECS.ewmaVolatility,
        isVisible: visible.ewmaVolatility,
        paneIndex: paneIndices.ewmaVolatility,
    });

    useElderRayChart({
        ...commonHookParams,
        isVisible: visible.elderRay,
        paneIndex: paneIndices.elderRay,
    });

    useSqueezeMomentumChart({
        ...commonHookParams,
        isVisible: visible.squeezeMomentum,
        paneIndex: paneIndices.squeezeMomentum,
    });

    useRegressionChart({
        ...commonHookParams,
        isVisible: visible.regression,
        paneIndex: paneIndices.regression,
    });

    useCandlePatternMarkers({ seriesRef, bars });

    useActionRecommendationOverlay({
        seriesRef,
        actionPrices,
        reconciledPrices: reconciledActionPrices,
        isVisible: actionPricesVisible,
        lineWidth: DEFAULT_LINE_WIDTH,
    });

    useSmcZones({
        seriesRef,
        smc: indicators.smc,
        isVisible: visible.smc,
    });

    const barTimes = useMemo(() => barTimesOf(bars), [bars]);
    const lastBarTime = bars[bars.length - 1]?.time ?? 0;

    const hasExtendableLevels = useMemo(
        () =>
            hasDrawnLevels(chartOverlays, {
                hiddenKeys: hiddenOverlayKeys,
                barTimes,
                lastBarTime,
            }),
        [chartOverlays, hiddenOverlayKeys, barTimes, lastBarTime]
    );

    const overlaySpecs = useMemo(
        () =>
            buildOverlayLineSpecs(chartOverlays, {
                hiddenKeys: hiddenOverlayKeys,
                highlightedKey: highlightedOverlayKey,
                barTimes,
                lastBarTime,
                rsiPaneIndex: visible.rsi ? paneIndices.rsi : null,
                colorFor: (overlay, role) =>
                    (overlay.kind === 'pattern'
                        ? patternPalette.get(overlay.sourceRef)
                        : undefined) ??
                    overlayColorFor(
                        overlay,
                        role,
                        overlayColors,
                        CHART_OVERLAY_COLORS
                    ),
                levelLabelFor: (label, overlay) => {
                    if (label === BREAKOUT_LEVEL_LABEL)
                        return breakoutTitle(
                            patternLabels.get(overlay.sourceRef)
                        );
                    const outcome = formatOutcomeLevelLabel(
                        label,
                        overlay,
                        patternLabels.get(overlay.sourceRef),
                        outcomeLevelTexts
                    );
                    if (outcome !== null)
                        return outcomeLabelsCrowded &&
                            overlayItemKey(overlay) !== highlightedOverlayKey
                            ? ''
                            : outcome;
                    return (
                        formatFibLevelLabel(label, overlay, fibLevelTexts) ??
                        label
                    );
                },
                extendLevelsRight: levelRightExtend,
            }),
        [
            chartOverlays,
            hiddenOverlayKeys,
            highlightedOverlayKey,
            barTimes,
            lastBarTime,
            visible.rsi,
            paneIndices.rsi,
            overlayColors,
            breakoutTitle,
            patternLabels,
            fibLevelTexts,
            outcomeLevelTexts,
            outcomeLabelsCrowded,
            patternPalette,
            levelRightExtend,
        ]
    );

    useChartOverlays({
        chartRef,
        specs: overlaySpecs,
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
                keltnerVisible,
                donchianVisible,
                supertrendVisible,
                parabolicSarVisible,
                chandelierVisible,
            }),
        [
            maVisiblePeriods,
            emaVisiblePeriods,
            bollingerVisible,
            ichimokuVisible,
            vpVisible,
            keltnerVisible,
            donchianVisible,
            supertrendVisible,
            parabolicSarVisible,
            chandelierVisible,
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

    // 보조 pane이 늘어도 가격 pane이 절반 아래로 내려가지 않게 한다.
    // 크기를 재기 전에 실행되도록 usePricePaneSize보다 앞에 둔다.
    usePricePaneStretch(chartRef, paneIndices);

    const pricePaneSize = usePricePaneSize(chartRef, wrapperRef, paneIndices);

    /**
     * 오버레이/period 지표처럼 별도 훅 반환값을 받는 항목의 오버라이드 맵.
     * INDICATOR_REGISTRY 순회 시 이 맵에 있는 key는 오버라이드를 우선하고,
     * 없으면 `visible[key]` + `toggle(key)` 기본 패턴으로 폴백한다.
     */
    const overlayOverrides = useMemo<
        Partial<Record<string, Omit<IndicatorBinding, 'meta'>>>
    >(
        () => ({
            ma: {
                active: maVisiblePeriods.length > 0,
                availablePeriods: MA_DEFAULT_PERIODS,
                visiblePeriods: maVisiblePeriods,
                onTogglePeriod: toggleMAPeriod,
            },
            ema: {
                active: emaVisiblePeriods.length > 0,
                availablePeriods: EMA_DEFAULT_PERIODS,
                visiblePeriods: emaVisiblePeriods,
                onTogglePeriod: toggleEMAPeriod,
            },
            ichimoku: { active: ichimokuVisible, onToggle: toggleIchimoku },
            bollinger: { active: bollingerVisible, onToggle: toggleBollinger },
            volumeProfile: { active: vpVisible, onToggle: toggleVP },
            keltnerChannel: { active: keltnerVisible, onToggle: toggleKeltner },
            donchianChannel: {
                active: donchianVisible,
                onToggle: toggleDonchian,
            },
            supertrend: {
                active: supertrendVisible,
                onToggle: toggleSupertrend,
            },
            parabolicSar: {
                active: parabolicSarVisible,
                onToggle: toggleParabolicSar,
            },
            chandelierExit: {
                active: chandelierVisible,
                onToggle: toggleChandelier,
            },
        }),
        [
            maVisiblePeriods,
            emaVisiblePeriods,
            ichimokuVisible,
            bollingerVisible,
            vpVisible,
            keltnerVisible,
            donchianVisible,
            supertrendVisible,
            parabolicSarVisible,
            chandelierVisible,
            toggleMAPeriod,
            toggleEMAPeriod,
            toggleIchimoku,
            toggleBollinger,
            toggleVP,
            toggleKeltner,
            toggleDonchian,
            toggleSupertrend,
            toggleParabolicSar,
            toggleChandelier,
        ]
    );

    const indicatorBindings = useMemo<IndicatorBinding[]>(
        () =>
            INDICATOR_REGISTRY.map(meta => {
                const override = overlayOverrides[meta.key];
                if (override !== undefined) {
                    return { meta, ...override };
                }
                // visible이 Record<IndicatorKey, boolean>이라 string 키로 직접 색인 불가 — 캐스트 필요.
                // INDICATOR_REGISTRY는 IndicatorKey 멤버로만 구성되므로 캐스트 안전.
                const key = meta.key as IndicatorKey;
                return {
                    meta,
                    active: visible[key],
                    onToggle: () => toggle(key),
                };
            }),
        // deps에 visible 객체 전체를 둔다 — 한 지표 토글 시 전체 binding이 재조립되지만
        // 항목 수가 적어 비용은 무시할 만하며, 개별 visible 키를 나열하는 것보다 명료하다.
        [overlayOverrides, visible, toggle]
    );

    if (bars.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-secondary-400">
                    {t('StockChart.1b2664')}
                </p>
            </div>
        );
    }

    // Lightweight Charts 캔버스 자체는 스크린 리더가 읽을 수 없으므로 캔버스 컨테이너에
    // role/aria-label을 부여한다. wrapperRef에 붙이면 자식으로 들어가는
    // OverlayLegend의 인터랙티브 요소가 일부 스크린리더에서 presentational로 취급될 수 있어
    // 캔버스만 들어가는 containerRef에 둔다.
    const chartAriaLabel =
        ticker !== undefined && ticker !== ''
            ? tMisc('chartAria', { v0: ticker, v1: timeframe })
            : t('StockChart.a547a0');

    return (
        <div className="flex h-full w-full flex-col">
            {/* 톱니바퀴는 캔버스 밖 헤더 띠에 둔다(터미널 탭바의 `+` 자리). 캔버스
                위에 얹었을 때는 드래그·줌 중에 캔들을 가렸고 가격 눈금·범례와
                자리를 다퉜다. 띠 자체는 비워 둔다. */}
            <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-secondary-700 px-1">
                <ChartOverlayMenu
                    items={overlayItems}
                    hiddenKeys={hiddenOverlayKeys}
                    onSetVisible={onSetOverlayVisible}
                    itemColors={patternPalette}
                    onHighlight={onHighlightOverlay}
                    rightExtend={
                        hasExtendableLevels
                            ? {
                                  checked: levelRightExtend,
                                  onChange: setLevelRightExtend,
                              }
                            : undefined
                    }
                />
                <IndicatorSettingsModal bindings={indicatorBindings} />
            </div>
            <div ref={wrapperRef} className="relative min-h-0 w-full flex-1">
                <div
                    ref={containerRef}
                    className="h-full w-full"
                    role="img"
                    aria-label={chartAriaLabel}
                />
                {/* 범례는 자기 pane(pane 0) 안에만 머문다 — 넘치면 보조 pane 라벨을
                    덮어 두 글자가 겹쳐 찍힌다. 상한은 OverlayLegend가 실측 크기에서
                    계산하고, 넘친 항목 수는 `+N` 칩으로 드러낸다. */}
                <div className="pointer-events-none absolute top-2 left-2 z-10">
                    <OverlayLegend
                        items={overlayLegendItems}
                        decimals={priceDecimals}
                        pricePaneHeightPx={pricePaneSize.height}
                        chartWidthPx={pricePaneSize.width}
                    />
                </div>
            </div>
        </div>
    );
}
