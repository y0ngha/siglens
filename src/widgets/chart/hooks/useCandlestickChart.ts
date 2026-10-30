'use client';

/**
 * 가격 차트(lightweight-charts) 인스턴스와 캔들 시리즈의 수명을 소유하는 훅 — 마운트 시 한 번
 * 만들고, 로케일·타임프레임·가격 자릿수 변화는 옵션 갱신으로만 반영한다.
 */
import { type RefObject, useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import type { Timeframe } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import { chartLocalization } from '../utils/chartLocalization';
import { chartPriceFormat } from '../utils/chartPriceFormat';
import type { ExtendedGapController } from '../utils/extendedGapChart';

interface UseCandlestickChartParams {
    containerRef: RefObject<HTMLDivElement | null>;
    /** 지표 훅에 줄 차트를 감싸는 어댑터(시간외 구간에서 지표 선을 끊는다). 인스턴스 수명 동안 고정. */
    gapController: ExtendedGapController;
    priceDecimals: number;
    locale: Locale;
    timeframe: Timeframe;
    /** 차트 인스턴스가 준비되면 호출된다(거래량 차트와 visible range 동기화). */
    onChartReady?: (chart: IChartApi) => void;
    /** 차트가 제거되기 직전에 호출된다(구독 해제). */
    onChartRemove?: () => void;
}

interface UseCandlestickChartReturn {
    /** 진짜 차트 — 작도·primitive·시간축 맞춤이 쓴다. */
    chartRef: RefObject<IChartApi | null>;
    /** 시간외 구간에서 끊기는 지표 전용 차트 어댑터. */
    indicatorChartRef: RefObject<IChartApi | null>;
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
}

/** 마운트 시 차트·캔들 시리즈를 한 번 만들고, 로케일·타임프레임·자릿수 변화는 옵션으로 반영한다. */
export function useCandlestickChart({
    containerRef,
    gapController,
    priceDecimals,
    locale,
    timeframe,
    onChartReady,
    onChartRemove,
}: UseCandlestickChartParams): UseCandlestickChartReturn {
    const chartRef = useRef<IChartApi | null>(null);
    // 차트 생성 effect가 `chartRef`와 함께 채운다(지표 훅 effect는 선언 순서상 그 뒤에 돈다).
    const indicatorChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', UTCTimestamp> | null>(
        null
    );
    // mount-only 생성 effect가 deps 없이 최신 값을 읽도록 ref로 미러링한다 — deps에 넣으면
    // 값이 바뀔 때마다 차트가 재생성된다. 이후 변화는 아래 옵션 effect가 반영한다.
    const latestRef = useRef({
        gapController,
        priceDecimals,
        locale,
        onChartReady,
        onChartRemove,
    });
    useEffect(() => {
        latestRef.current = {
            gapController,
            priceDecimals,
            locale,
            onChartReady,
            onChartRemove,
        };
    });

    useEffect(() => {
        if (!containerRef.current) return;
        const latest = latestRef.current;

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
        indicatorChartRef.current = latest.gapController.wrap(chart);

        seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: CHART_COLORS.bullish,
            downColor: CHART_COLORS.bearish,
            borderUpColor: CHART_COLORS.bullish,
            borderDownColor: CHART_COLORS.bearish,
            wickUpColor: CHART_COLORS.bullish,
            wickDownColor: CHART_COLORS.bearish,
            priceFormat: chartPriceFormat(latest.priceDecimals, latest.locale),
            // LWC addSeries() 반환 타입에 UTCTimestamp 제네릭이 없어 타입 가드 불가 — 라이브러리 타입 한계.
        }) as ISeriesApi<'Candlestick', UTCTimestamp>;

        latest.onChartReady?.(chart);

        return () => {
            latestRef.current.onChartRemove?.();
            // autoSize 해제 후 remove — LWC ResizeObserver가 disposed 객체에 접근하는 에러 방지.
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            indicatorChartRef.current = null;
            seriesRef.current = null;
        };
    }, [containerRef]);

    useEffect(() => {
        chartRef.current?.applyOptions({
            localization: chartLocalization(locale, timeframe),
        });
    }, [timeframe, locale]);

    // 마운트된 채 클라이언트 사이드 심볼 탐색(예: 일반 주식 → 크립토)이 일어나면 생성 시점의
    // priceFormat이 구식이 된다. 자릿수·로케일이 바뀌면 기존 시리즈에 다시 입혀 sub-cent
    // 토큰이 망가진 가격으로 표시되는 것을 막는다.
    useEffect(() => {
        seriesRef.current?.applyOptions({
            priceFormat: chartPriceFormat(priceDecimals, locale),
        });
    }, [priceDecimals, locale]);

    return { chartRef, indicatorChartRef, seriesRef };
}
