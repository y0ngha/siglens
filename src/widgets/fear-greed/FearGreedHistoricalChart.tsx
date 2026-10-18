'use client';

import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import {
    createChart,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type Time,
    TickMarkType,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { TRADING_DAYS_1Y } from '@/widgets/fear-greed/constants';

interface FearGreedHistoricalChartProps {
    history: FearGreedHistoryPoint[];
}

const CHART_HEIGHT = 240;
const LINE_WIDTH = 1;

/**
 * 1년 시계열이라 월 단위 눈금만 쓴다. 기본 포매터는 월 눈금이 앞 눈금과 붙으면 그것을
 * 건너뛰고 그 오른쪽 일(day) 눈금을 남겨, 마지막 눈금이 "10월" 대신 "5일"로 찍혔다.
 * 일 눈금은 빈 문자열로 지우고, 나머지는 `null`로 기본 포맷(월·연)에 맡긴다.
 * 고정된 1년 화면 전제다 — 그래서 차트 옵션에서 확대(`handleScale: false`)를 막는다. 확대를
 * 허용하게 되면 일 눈금이 전부 사라지므로 이 포매터를 다시 본다.
 */
function monthTickFormatter(_time: Time, type: TickMarkType): string | null {
    return type === TickMarkType.DayOfMonth ? '' : null;
}

/**
 * 1-year fearGreed score line chart (the last `TRADING_DAYS_1Y` points). Warm-up entries (`score === null`) are
 * filtered out — the time series will naturally show gaps where the algorithm
 * is below confidence threshold.
 *
 * Uses lightweight-charts v5 API (`chart.addSeries(LineSeries, ...)`) and
 * `autoSize: true` for resize handling, matching the existing chart pattern
 * in `useVolumeChartLifecycle`.
 */
export function FearGreedHistoricalChart({
    history,
}: FearGreedHistoricalChartProps) {
    const t = useTranslations('widgets.chart');
    // 차트는 마운트 때 한 번 만든다 — 로케일은 그때 값으로 충분하다. 로케일은 URL 세그먼트
    // (`app/[locale]/layout.tsx`)라 전환은 다른 경로로의 이동이고, 이 컴포넌트가 새로
    // 마운트된다. effect 의존성에 넣지 않도록 ref로 읽는다.
    const locale = useResolvedLocale();
    const intlLocaleRef = useRef(INTL_LOCALE[locale]);
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    /* 테마 전환 시 크롬만 교체(리마운트 없음). */
    /* 이 차트는 배경을 투명하게 둬 부모 카드 색을 비춘다 — 배경은 건드리지 않는다. */
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        /* 생성 시점의 테마에 맞는 크롬. 테마 전환은 마운트 지점의
           `key={themeVersion}`이 이 컴포넌트를 remount해 처리한다. */
        const chrome = getChartChrome();

        const chart = createChart(containerRef.current, {
            height: CHART_HEIGHT,
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
        // 서버는 "1년 전" 비교 게이지 때문에 약 2년을 보낸다 — 차트 제목("최근 1년")에 맞춰 마지막 1년만 그린다.
        const data: LineData[] = history
            .slice(-TRADING_DAYS_1Y)
            .filter(
                (p): p is FearGreedHistoryPoint & { score: number } =>
                    p.score !== null
            )
            .map(p => ({
                // FearGreedHistoryPoint.date는 항상 'YYYY-MM-DD' 형식 — lightweight-charts Time(string) 계약 충족.
                time: p.date as Time,
                value: p.score,
            }));
        series.setData(data);
        chartRef.current?.timeScale().fitContent();
    }, [history]);

    return (
        <div
            ref={containerRef}
            // 차트가 그려지기 전에도 높이를 잡아 둔다(`CHART_HEIGHT`와 같은 값).
            className="h-[240px] w-full"
            role="img"
            aria-label={t('FearGreedHistoricalChart.9b98f6')}
        />
    );
}
