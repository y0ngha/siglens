'use client';

/**
 * 종목 페이지의 가격(캔들) 차트 — 차트 수명·캔들 데이터·지표·AI 작도·패인 레이아웃 훅을 연결하고
 * 헤더 띠·캔버스·범례를 배치하는 오케스트레이터다. 각 관심사는 `hooks/`·`utils/`·`ui/`가 맡는다.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type {
    Bar,
    ChartOverlay,
    IndicatorResult,
    ReconciledActionLineData,
    Timeframe,
    ValidatedActionPrices,
} from '@y0ngha/siglens-core';
import { EMPTY_INDICATOR_RESULT } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import {
    NO_EXTENDED_BARS,
    NO_SESSION_RANGES,
    buildExtendedSessionRanges,
    isExtendedBarTimeframe,
} from '@/shared/api/market/extendedBarsSession';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { resolvePriceDecimals } from '@/shared/lib/priceFormat';
import { DEFAULT_LINE_WIDTH, STORAGE_KEYS } from './constants';
import { OverlayLegend } from './OverlayLegend';
import type { ToggleSetting } from './types';
import { useActionRecommendationOverlay } from './hooks/useActionRecommendationOverlay';
import { useCandlePatternMarkers } from './hooks/useCandlePatternMarkers';
import { useCandlestickChart } from './hooks/useCandlestickChart';
import { useCandlestickData } from './hooks/useCandlestickData';
import { useChartOverlaySpecs } from './hooks/useChartOverlaySpecs';
import { useChartOverlays } from './hooks/useChartOverlays';
import { useExtendedSessionBand } from './hooks/useExtendedSessionBand';
import { useExtendedGapTimes } from './hooks/useExtendedGapTimes';
import { useIndicatorPaneCharts } from './hooks/useIndicatorPaneCharts';
import { useIndicatorVisibility } from './hooks/useIndicatorVisibility';
import { useOverlayLegend } from './hooks/useOverlayLegend';
import { usePaneLabels } from './hooks/usePaneLabels';
import { usePaneResizeOnToggle } from './hooks/usePaneResizeOnToggle';
import { usePriceOverlayIndicators } from './hooks/usePriceOverlayIndicators';
import { usePricePaneSize } from './hooks/usePricePaneSize';
import { usePricePaneStretch } from './hooks/usePricePaneStretch';
import { useRightGutter } from './hooks/useRightGutter';
import { useSmcZones } from './hooks/useSmcZones';
import type { IndicatorHookParams } from './model/chartHookParams';
import { ChartHeaderBar } from './ui/ChartHeaderBar';
import { ExtendedHoursLegendBadge } from './ui/ExtendedHoursLegendBadge';
import { createExtendedGapController } from './utils/extendedGapChart';
import { buildIndicatorBindings } from './utils/indicatorBindings';
import {
    createCanvasTextMeasurer,
    LEVEL_TITLE_FONT,
    type TextMeasurer,
} from './utils/levelLabelGutter';
import type { OverlayMenuItem } from './utils/overlayItems';
import { buildPaneLabels } from './utils/paneLabelUtils';

const EMPTY_CHART_OVERLAYS: ChartOverlay[] = [];
const EMPTY_OVERLAY_ITEMS: readonly OverlayMenuItem[] = [];
const EMPTY_HIDDEN_KEYS: ReadonlySet<string> = new Set();
const NOOP_SET_VISIBLE = (): void => {};
const EMPTY_OVERLAY_COLORS: Record<string, string> = {};

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
     * 사용자가 **두 차트 중 어느 쪽이든** 밀거나 확대했는가(`useChartSync.isUserAdjustedView` — 입력 리스너는
     * 거기 한 곳에만 있다). 시간외 봉이 나중에 도착했을 때 보던 자리를 지킬지 정한다. 생략하면 조정 기록이 없는
     * 것으로 보고 항상 맞춘다.
     */
    isViewAdjusted?: () => boolean;
    /** 맞춤이 새로 일어나 조정 기록을 지울 때 부른다(`useChartSync.resetUserAdjustedView`). */
    onViewAdjustmentReset?: () => void;
    /** 시간외 표시 토글. 넘기면 "차트 설정"(톱니바퀴) 메뉴의 행이 켜진다(미국 주식 인트라데이만). 생략하면 사유와 함께 비활성으로 보인다. */
    extendedHours?: ToggleSetting;
    /**
     * 헤더 띠 **왼쪽**에 놓을 내용(시간외 시세 한 줄). 메뉴 셋 앞의 `flex-1 min-w-0` 형제라 자리는 로케일별 실제
     * 트리거 폭이 정하고 — 고정 inset 없이 메뉴와 겹치지 않는다. 폭이 모자라면 슬롯이 먼저 줄어든다.
     */
    headerStartSlot?: ReactNode;
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
    extendedBars = NO_EXTENDED_BARS,
    extendedHours,
    headerStartSlot,
    isViewAdjusted,
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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { visible, toggle, paneIndices } = useIndicatorVisibility();

    // 작도 수평 레벨 오른쪽 연장 — 분석·종목이 바뀌어도 유지되는 사용자 환경설정(localStorage).
    const [levelRightExtend, setLevelRightExtend] = usePersistentState(
        STORAGE_KEYS.levelRightExtend,
        true
    );

    // 지표 시리즈가 시간외 구간에서 끊기게 하는 차트 어댑터 — **지표 훅에만** 준다. 추세선·작도
    // 레벨(`useChartOverlays`)과 primitive는 진짜 `chartRef`를 써서 계속 이어진다.
    const [gapController] = useState(createExtendedGapController);

    // 가격 표시 소수 자릿수 — 캔들 시리즈 priceFormat과 오버레이 범례가 공유한다.
    // descriptor가 fixed/integer면 정적, dynamic(크립토)이면 최신 종가의 크기에서
    // 유효 자릿수를 파생한다(sub-cent 토큰이 2dp로 0.00으로 뭉개지는 것 방지).
    const priceDecimals = useMemo(
        () => resolvePriceDecimals(marketProfile, bars.at(-1)?.close),
        [marketProfile, bars]
    );

    const { chartRef, indicatorChartRef, seriesRef } = useCandlestickChart({
        containerRef,
        gapController,
        priceDecimals,
        locale,
        timeframe,
        onChartReady,
        onChartRemove,
    });

    useCandlestickData({
        chartRef,
        seriesRef,
        bars,
        extendedBars,
        elderImpulse: indicators.elderImpulse,
        showElderImpulse: visible.elderImpulse,
        isViewAdjusted,
        onViewAdjustmentReset,
    });

    useExtendedGapTimes(gapController, extendedBars);

    // 프리·애프터마켓 구간 음영(시간외 봉이 없으면 아무것도 붙이지 않는다).
    const extendedRanges = useMemo(
        () =>
            isExtendedBarTimeframe(timeframe)
                ? buildExtendedSessionRanges(extendedBars, timeframe)
                : NO_SESSION_RANGES,
        [extendedBars, timeframe]
    );
    useExtendedSessionBand(seriesRef, extendedRanges);

    const indicatorParams: IndicatorHookParams = {
        chartRef: indicatorChartRef,
        bars,
        indicators,
        lineWidth: DEFAULT_LINE_WIDTH,
    };
    // 일목균형표 선행 구름은 마지막 **그려진** 봉(정규장 + 시간외) 오른쪽에서 시작해야 한다.
    const futureAnchorTime = (displayBars ?? bars).at(-1)?.time;
    const { bindingOverrides, labelConfigs } = usePriceOverlayIndicators(
        indicatorParams,
        futureAnchorTime
    );
    useIndicatorPaneCharts(indicatorParams, visible, paneIndices);

    useCandlePatternMarkers({ seriesRef, bars });

    useActionRecommendationOverlay({
        seriesRef,
        actionPrices,
        reconciledPrices: reconciledActionPrices,
        isVisible: actionPricesVisible,
        lineWidth: DEFAULT_LINE_WIDTH,
    });

    useSmcZones({ seriesRef, smc: indicators.smc, isVisible: visible.smc });

    const overlaySpecs = useChartOverlaySpecs({
        chartOverlays,
        overlayColors,
        overlayItems,
        hiddenOverlayKeys,
        highlightedOverlayKey,
        bars,
        rsiPaneIndex: visible.rsi ? paneIndices.rsi : null,
        extendLevelsRight: levelRightExtend,
    });

    useChartOverlays({
        chartRef,
        specs: overlaySpecs.specs,
        lineWidth: DEFAULT_LINE_WIDTH,
    });

    usePaneResizeOnToggle(chartRef, wrapperRef, paneIndices);

    const overlayLegendItems = useOverlayLegend({
        chartRef,
        bars,
        indicators,
        labelConfigs,
    });

    const paneLabels = useMemo(
        () => buildPaneLabels(paneIndices),
        [paneIndices]
    );
    usePaneLabels({ chartRef, containerRef: wrapperRef, labels: paneLabels });

    // 보조 pane이 늘어도 가격 pane이 절반 아래로 내려가지 않게 한다.
    // 크기를 재기 전에 실행되도록 usePricePaneSize보다 앞에 둔다.
    usePricePaneStretch(chartRef, paneIndices);
    const pricePaneSize = usePricePaneSize(chartRef, wrapperRef, paneIndices);

    useRightGutter(
        overlaySpecs.levelTitles,
        measureText,
        pricePaneSize.width,
        onRightGutterChange
    );

    // deps에 visible 객체 전체를 둔다 — 한 지표 토글 시 전체 binding이 재조립되지만
    // 항목 수가 적어 비용은 무시할 만하며, 개별 visible 키를 나열하는 것보다 명료하다.
    const indicatorBindings = useMemo(
        () => buildIndicatorBindings(bindingOverrides, visible, toggle),
        [bindingOverrides, visible, toggle]
    );

    const hasBars = bars.length > 0;
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
            {hasBars && (
                <ChartHeaderBar
                    startSlot={headerStartSlot}
                    indicatorBindings={indicatorBindings}
                    overlayItems={overlayItems}
                    hiddenOverlayKeys={hiddenOverlayKeys}
                    onSetOverlayVisible={onSetOverlayVisible}
                    overlayItemColors={overlaySpecs.patternPalette}
                    onHighlightOverlay={onHighlightOverlay}
                    levelRightExtend={
                        overlaySpecs.hasExtendableLevels
                            ? {
                                  checked: levelRightExtend,
                                  onChange: setLevelRightExtend,
                              }
                            : undefined
                    }
                    extendedHours={extendedHours}
                />
            )}
            {/* 캔버스 컨테이너는 봉이 없어도 마운트해 둔다 — 차트는 마운트 시 한 번만 만들어지므로,
                빈 상태에서 컨테이너를 빼면 데이터가 와도 차트가 영영 생기지 않거나 떨어져 나간
                노드에 그린다. 빈 상태에서는 캔버스를 감추고 문구를 그 자리에 띄운다. */}
            <div ref={wrapperRef} className="relative min-h-0 w-full flex-1">
                <div
                    ref={containerRef}
                    // 빈 상태에서는 감추되(visibility) 크기는 유지한다 — autoSize가 계속 잰다.
                    className={
                        hasBars ? 'h-full w-full' : 'invisible h-full w-full'
                    }
                    role={hasBars ? 'img' : undefined}
                    aria-label={hasBars ? chartAriaLabel : undefined}
                    aria-hidden={hasBars ? undefined : true}
                />
                {hasBars ? (
                    <>
                        {extendedBars.length > 0 && (
                            <ExtendedHoursLegendBadge />
                        )}
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
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm text-secondary-400">
                            {t('StockChart.1b2664')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
