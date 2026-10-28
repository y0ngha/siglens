'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
    createChart,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
} from 'lightweight-charts';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { monthTickFormatter } from '../utils/monthTickFormatter';
import { toLineData } from '../utils/toLineData';

const FEAR_GREED_CHART_HEIGHT = 240;
const LINE_WIDTH = 1;

/**
 * 1년 공포·탐욕 점수 선 차트를 컨테이너에 붙이고 `history`를 그린다.
 *
 * lightweight-charts v5 API(`chart.addSeries(LineSeries, …)`)와 `autoSize: true`로 크기를
 * 맞춘다. 차트는 마운트 때 한 번 만들고, 데이터는 `history`가 바뀔 때마다 갈아 끼운다.
 *
 * @param history - 점수 history. 마지막 1년만 그리고 워밍업(`score === null`)은 건너뛴다.
 * @returns 차트가 그려질 `div`에 연결할 ref.
 */
export function useFearGreedLineChart(
    history: readonly FearGreedHistoryPoint[]
): RefObject<HTMLDivElement | null> {
    // 로케일은 URL 세그먼트라 전환은 다른 경로로의 이동이고 이 훅이 새로 마운트된다. 차트는
    // 마운트 때 한 번 만들므로 그때 값이면 충분하고, effect 의존성에 넣지 않도록 ref로 읽는다.
    const locale = useResolvedLocale();
    const intlLocaleRef = useRef(INTL_LOCALE[locale]);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        // 생성 시점의 테마에 맞는 크롬. 테마 전환은 마운트 지점의 `key={themeVersion}`이
        // 이 컴포넌트를 remount해 처리한다. 배경은 투명으로 둬 부모 카드 색을 비춘다.
        const chrome = getChartChrome();

        const chart = createChart(containerRef.current, {
            height: FEAR_GREED_CHART_HEIGHT,
            autoSize: true,
            layout: {
                background: { color: 'transparent' },
                textColor: chrome.text,
            },
            grid: {
                vertLines: { color: chrome.grid },
                horzLines: { color: chrome.grid },
            },
            // 눈금 언어를 브라우저(`navigator.language`)가 아니라 페이지 로케일에 맞춘다.
            localization: { locale: intlLocaleRef.current },
            timeScale: {
                borderVisible: false,
                tickMarkFormatter: monthTickFormatter,
            },
            // 1년 고정 화면 — 일 눈금을 지우는 `monthTickFormatter`의 전제다.
            handleScale: false,
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
        });
        const series = chart.addSeries(LineSeries, {
            // 상수로 빼지 않는다 — 모듈 로드 시점에 굳으면 라이트에서 옛 색이 남는다.
            color: CHART_COLORS.actionEntry,
            lineWidth: LINE_WIDTH,
            autoscaleInfoProvider: () => ({
                priceRange: { minValue: 0, maxValue: 100 },
                margins: { above: 0.1, below: 0.1 },
            }),
        });
        chartRef.current = chart;
        seriesRef.current = series;
        return () => {
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const series = seriesRef.current;
        if (!series) return;
        series.setData(toLineData(history));
        chartRef.current?.timeScale().fitContent();
    }, [history]);

    return containerRef;
}
