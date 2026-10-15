'use client';

import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { INTL_LOCALE } from '@/shared/i18n/locales';

import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
    buildExtendedSessionRanges,
    isExtendedBarTimeframe,
    type ExtendedSessionRange,
} from '@/shared/api/market/extendedBarsSession';
import { buildCandlestickDataWithExtended } from './utils/extendedBarsDisplay';
import { useExtendedSessionBand } from './hooks/useExtendedSessionBand';
import { createExtendedGapController } from './utils/extendedGapChart';
import {
    restoreVisibleView,
    snapshotVisibleView,
    type VisibleViewSnapshot,
} from './utils/visibleViewSnapshot';
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
import {
    EMA_DEFAULT_PERIODS,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import type { ToggleSetting } from './types';
import { resolvePriceDecimals } from '@/shared/lib/priceFormat';
import { IndicatorSettingsModal } from './ui/IndicatorSettingsModal';
import { ChartOverlayMenu } from './ui/ChartOverlayMenu';
import { useChartOverlays } from './hooks/useChartOverlays';
import {
    barTimesOf,
    buildOverlayLineSpecs,
    hasDrawnLevels,
    overlayColorFor,
} from './utils/chartOverlayUtils';
import {
    patternLabelsByKey,
    patternPaletteByKey,
    type OverlayMenuItem,
} from './utils/overlayItems';
import { type FibLevelTexts } from './utils/fibLevelLabel';
import { levelTitleFor } from './utils/levelTitle';
import {
    createCanvasTextMeasurer,
    LEVEL_TITLE_FONT,
    levelLabelGutterPx,
    type TextMeasurer,
} from './utils/levelLabelGutter';
import { type OutcomeLevelTexts } from './utils/outcomeLevelLabel';
import { CHART_OVERLAY_COLORS } from './model/chartOverlayCategories';
import {
    INDICATOR_REGISTRY,
    type IndicatorBinding,
    type IndicatorKey,
} from './model/indicatorRegistry';

// A-B-C 표기는 언어 중립이라 번역하지 않는다.
const ABC_STRUCTURE_NAME = 'A-B-C';
const EMPTY_CHART_OVERLAYS: ChartOverlay[] = [];
const EMPTY_OVERLAY_ITEMS: readonly OverlayMenuItem[] = [];
const EMPTY_HIDDEN_KEYS: ReadonlySet<string> = new Set();
const NOOP_SET_VISIBLE = (): void => {};
const EMPTY_OVERLAY_COLORS: Record<string, string> = {};
const EMPTY_BARS: Bar[] = [];
const EMPTY_SESSION_RANGES: readonly ExtendedSessionRange[] = [];

interface CommonHookParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth: LineWidth;
}

interface StockChartProps {
    /**
     * **정규장 봉** — 지표·작도·캔들 패턴·Elder 임펄스 색의 기준이다. 모든 지표 오버레이는 이
     * 배열과 짝지어지고(tail 정렬) 이 봉들의 시각에 찍힌다. 시간외 봉이 있어도 바뀌지 않는다.
     */
    bars: Bar[];
    /**
     * 캔들·거래량에 그릴 봉 전체(정규장 봉 + 시간외 봉, 시각 오름차순). 생략하면 `bars`.
     * 시간외 봉이 없을 때는 `bars`와 같은 참조여야 한다(불필요한 재계산 방지).
     */
    displayBars?: Bar[];
    /** `displayBars` 중 프리·애프터마켓 봉만. 비어 있으면 캔들·음영·범례가 기존과 같다. */
    extendedBars?: Bar[];
    /**
     * 다른 차트(거래량)에서 사용자가 밀거나 확대했는가(`useChartSync.isUserAdjustedView`). 이 차트의 입력과
     * 합쳐 "사용자가 보기를 조정했다"를 판정한다 — 거래량 pane을 밀어 본 사용자의 보기가 시간외 봉 도착에
     * 날아가지 않게 한다. 생략하면 이 차트의 입력만 센다.
     */
    isViewAdjustedElsewhere?: () => boolean;
    /** 맞춤이 새로 일어나 조정 기록을 지울 때 부른다(`useChartSync.resetUserAdjustedView`). */
    onViewAdjustmentReset?: () => void;
    /** 시간외 표시 토글. 넘기면 "차트 작도" 메뉴에 행이 생긴다(미국 주식 인트라데이만). */
    extendedHours?: ToggleSetting;
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
    /**
     * 레벨선 제목이 마지막 캔들을 덮지 않도록 비워 둘 오른쪽 여백(px)이 정해지거나
     * 바뀌면 호출된다(제목이 없으면 `0`). 소비처가 이 값을 두 차트의 시간축
     * `rightOffsetPixels`로 적용한다(`useChartSync.setRightOffsetPixels`).
     */
    onRightGutterChange?: (pixels: number) => void;
    /** 제목 폭 측정기 — 기본은 차트 글꼴의 캔버스 `measureText`. 테스트가 주입한다. */
    measureText?: TextMeasurer;
}

// 모듈 단위로 하나 — 캔버스·컨텍스트를 인스턴스마다 만들지 않는다.
const defaultMeasureText = createCanvasTextMeasurer(LEVEL_TITLE_FONT);

export function StockChart({
    bars,
    displayBars,
    extendedBars = EMPTY_BARS,
    extendedHours,
    isViewAdjustedElsewhere,
    onViewAdjustmentReset,
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
    onRightGutterChange,
    measureText = defaultMeasureText,
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
                abc: ABC_STRUCTURE_NAME,
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
    // 사용자가 이 차트를 직접 밀거나 확대했는가, 그리고 마지막으로 보인 시간 범위 — 시간외 봉이 **나중에**
    // 도착했을 때 보던 자리를 지키는 데 쓴다(아래 시간축 맞춤 effect).
    const userAdjustedViewRef = useRef(false);
    const isViewAdjustedElsewhereRef = useRef(isViewAdjustedElsewhere);
    const onViewAdjustmentResetRef = useRef(onViewAdjustmentReset);
    // 데이터를 바꾸기 직전의 보던 자리(`snapshotVisibleView` JSDoc).
    const viewBeforeDataRef = useRef<VisibleViewSnapshot | null>(null);
    const lastFitBarsRef = useRef<Bar[] | null>(null);
    const onChartReadyRef = useRef(onChartReady);
    const onChartRemoveRef = useRef(onChartRemove);
    const onRightGutterChangeRef = useRef(onRightGutterChange);
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

    // 지표 시리즈가 시간외 구간에서 끊기게 하는 차트 어댑터 — **지표 훅에만** 준다. 추세선·작도
    // 레벨(`useChartOverlays`)과 primitive는 진짜 `chartRef`를 써서 계속 이어진다.
    const [gapController] = useState(createExtendedGapController);
    const indicatorChartRef = useMemo<RefObject<IChartApi | null>>(
        () => ({
            get current() {
                return gapController.wrap(chartRef.current);
            },
        }),
        [gapController]
    );

    const commonHookParams: CommonHookParams = {
        chartRef: indicatorChartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH,
    };

    // 캔들·시간축 맞춤에 쓰는 봉(정규장 + 시간외). 지표 훅은 위 `bars`(정규장)만 받는다.
    const chartBars = displayBars ?? bars;
    // 일목균형표 선행 구름은 마지막 **그려진** 봉 오른쪽에서 시작해야 한다(시간외 캔들 위로 겹치지 않게).
    const futureAnchorTime = chartBars.at(-1)?.time;
    const extendedRanges = useMemo(
        () =>
            isExtendedBarTimeframe(timeframe)
                ? buildExtendedSessionRanges(extendedBars, timeframe)
                : EMPTY_SESSION_RANGES,
        [extendedBars, timeframe]
    );

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
        onRightGutterChangeRef.current = onRightGutterChange;
        isViewAdjustedElsewhereRef.current = isViewAdjustedElsewhere;
        onViewAdjustmentResetRef.current = onViewAdjustmentReset;
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

        // 밀기·확대는 포인터·휠·터치 입력으로만 일어난다. 프로그램의 fitContent와 구분하려고 입력을 직접 듣는다.
        const container = containerRef.current;
        const markAdjusted = (): void => {
            userAdjustedViewRef.current = true;
        };
        const inputEvents = ['pointerdown', 'wheel', 'touchstart'] as const;
        inputEvents.forEach(type =>
            container.addEventListener(type, markAdjusted, { passive: true })
        );

        onChartReadyRef.current?.(chart);

        return () => {
            inputEvents.forEach(type =>
                container.removeEventListener(type, markAdjusted)
            );
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

        // setData가 보이는 범위를 동기로 밀어내므로 그 전에 보던 자리를 찍어 둔다.
        viewBeforeDataRef.current = snapshotVisibleView(
            chartRef.current.timeScale()
        );
        seriesRef.current.setData(
            buildCandlestickDataWithExtended(
                bars,
                extendedBars,
                indicators.elderImpulse,
                visible.elderImpulse
            )
        );
    }, [bars, extendedBars, indicators.elderImpulse, visible.elderImpulse]);

    // 시간축 맞춤. 정규장 봉(`bars`)이 바뀌거나(데이터 로드·심볼·타임프레임·새로고침) 첫 렌더면 맞춘다 — Elder
    // Impulse 토글로 setData가 재실행돼도 줌·스크롤이 초기화되지 않도록 의존성은 봉 배열뿐이다.
    // 시간외 봉만 **나중에** 도착·토글된 경우(`bars` 동일)에는, 사용자가 이미 밀거나 확대했다면 맞추지 않고
    // 보던 시간 범위를 그대로 복원한다(같은 정규장 봉이 계속 화면에 있다). 사용자가 건드리지 않았다면 맞춘다.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        const previous = lastFitBarsRef.current;
        const regularChanged = previous !== bars;
        lastFitBarsRef.current = bars;
        const view = viewBeforeDataRef.current;
        if (
            previous !== null &&
            !regularChanged &&
            (userAdjustedViewRef.current ||
                isViewAdjustedElsewhereRef.current?.() === true) &&
            view !== null &&
            restoreVisibleView(chart.timeScale(), view)
        ) {
            return;
        }
        if (regularChanged) {
            userAdjustedViewRef.current = false;
            onViewAdjustmentResetRef.current?.();
        }
        chart.timeScale().fitContent();
    }, [bars, chartBars]);

    // 시간외 시각마다 지표 선을 끊는다(`extendedGapChart` JSDoc). 이미 그려진 시리즈도 다시 채운다.
    const gapTimes = useMemo(
        () => extendedBars.map(b => b.time),
        [extendedBars]
    );
    useEffect(() => {
        gapController.setGapTimes(gapTimes);
    }, [gapController, gapTimes]);

    // 프리·애프터마켓 구간 음영(시간외 봉이 없으면 아무것도 붙이지 않는다).
    useExtendedSessionBand(seriesRef, extendedRanges);

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
        useIchimokuOverlay({ ...commonHookParams, futureAnchorTime });

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

    // 강조(hover) 항목만 인자로 뺀다 — 같은 입력에서 "화면에 그릴 specs"와
    // "여백 계산용 제목 목록"을 둘 다 뽑기 위해서다(아래 `rightGutterPx`).
    const buildSpecs = useCallback(
        (highlightedKey: string | null) =>
            buildOverlayLineSpecs(chartOverlays, {
                hiddenKeys: hiddenOverlayKeys,
                highlightedKey,
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
                levelLabelFor: (label, overlay) =>
                    levelTitleFor(label, overlay, {
                        cardName: patternLabels.get(overlay.sourceRef),
                        breakoutTitle,
                        outcomeTexts: outcomeLevelTexts,
                        fibTexts: fibLevelTexts,
                    }),
                extendLevelsRight: levelRightExtend,
            }),
        [
            chartOverlays,
            hiddenOverlayKeys,
            barTimes,
            lastBarTime,
            visible.rsi,
            paneIndices.rsi,
            overlayColors,
            breakoutTitle,
            patternLabels,
            fibLevelTexts,
            outcomeLevelTexts,
            patternPalette,
            levelRightExtend,
        ]
    );

    const overlaySpecs = useMemo(
        () => buildSpecs(highlightedOverlayKey),
        [buildSpecs, highlightedOverlayKey]
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

    /*
     * 레벨선 제목이 마지막 캔들을 덮지 않도록 비울 오른쪽 여백.
     *
     * 제목은 **강조를 뺀 전체** 목록으로 잰다. 겹치는 라벨은 그릴 때 좌표로 숨기고
     * (`useChartOverlays`) 강조한 작도가 우선 자리를 잡는데, 보이는 라벨로 재면 카드에
     * 마우스를 올릴 때마다 여백이 늘었다 줄고 — `rightOffsetPixels`를 바꾸면 스크롤
     * 위치가 오른쪽 끝으로 돌아가므로 — 차트가 흔들린다. 최대 폭으로 고정해 두면 hover는
     * 여백을 건드리지 않는다.
     */
    const levelTitles = useMemo(
        () => buildSpecs(null).map(spec => spec.title),
        [buildSpecs]
    );
    const rightGutterPx = useMemo(
        () => levelLabelGutterPx(levelTitles, measureText, pricePaneSize.width),
        [levelTitles, measureText, pricePaneSize.width]
    );

    useEffect(() => {
        // 측정된 라벨 폭에서 계산한 우측 여백을 부모 차트 레이아웃에 알린다. 콜백은 ref로 읽어 재등록이 없고, 값은 렌더 중에 알 수 없다(텍스트 측정).
        // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent
        onRightGutterChangeRef.current?.(rightGutterPx);
    }, [rightGutterPx]);

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
                    extendedHours={extendedHours}
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
                {extendedBars.length > 0 && (
                    <div className="pointer-events-none absolute top-1 right-16 z-10 flex items-center gap-1 rounded bg-secondary-900/80 px-1.5 py-0.5 text-[10px] text-secondary-300">
                        <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-sm border border-secondary-500/70 bg-secondary-500/30"
                        />
                        <span>{t('StockChart.extendedHoursLegend')}</span>
                    </div>
                )}
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
