'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { HistogramSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

interface UseMACDChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useMACDChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseMACDChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const signalLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const histogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        macdLineSeriesRef.current = null;
        signalLineSeriesRef.current = null;
        histogramSeriesRef.current = null;
    });

    // isVisible false 또는 paneIndex 변경 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (macdLineSeriesRef.current) {
            chart.removeSeries(macdLineSeriesRef.current);
            macdLineSeriesRef.current = null;
        }
        if (signalLineSeriesRef.current) {
            chart.removeSeries(signalLineSeriesRef.current);
            signalLineSeriesRef.current = null;
        }
        if (histogramSeriesRef.current) {
            chart.removeSeries(histogramSeriesRef.current);
            histogramSeriesRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (!isVisible) {
            removeAllSeries(chart);
            return;
        }

        // paneIndex 변경 시 시리즈 제거 후 재생성
        if (
            prevPaneIndexRef.current !== paneIndex &&
            macdLineSeriesRef.current
        ) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!macdLineSeriesRef.current) {
            macdLineSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.macdLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }

        if (!signalLineSeriesRef.current) {
            signalLineSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.macdSignal,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }

        if (!histogramSeriesRef.current) {
            histogramSeriesRef.current = chart.addSeries(
                HistogramSeries,
                {
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }

        macdLineSeriesRef.current.applyOptions({ lineWidth });
        signalLineSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { macd } = indicators;
        if (!macd.length) return;

        if (
            !macdLineSeriesRef.current ||
            !signalLineSeriesRef.current ||
            !histogramSeriesRef.current
        )
            return;

        const macdLineData = buildSeriesData(bars, macd, 'macd');
        const signalLineData = buildSeriesData(bars, macd, 'signal');
        const histogramData = buildSeriesData(bars, macd, 'histogram', value =>
            value >= 0
                ? CHART_COLORS.macdHistogramBullish
                : CHART_COLORS.macdHistogramBearish
        );

        macdLineSeriesRef.current.setData(macdLineData);
        signalLineSeriesRef.current.setData(signalLineData);
        histogramSeriesRef.current.setData(histogramData);
    }, [indicators, bars, isVisible, paneIndex]);
}
