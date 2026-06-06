'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import {
    CONNORS_RSI_OVERBOUGHT_LEVEL,
    CONNORS_RSI_OVERSOLD_LEVEL,
} from '../constants/indicatorLevels';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseConnorsRsiChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useConnorsRsiChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseConnorsRsiChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = null;
    });

    // isVisible false 또는 paneIndex 변경 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거) — 데이터 세팅은 아래 effect가 단독 담당
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
        if (prevPaneIndexRef.current !== paneIndex && seriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!seriesRef.current) {
            seriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.connorsRsiLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            seriesRef.current.createPriceLine({
                price: CONNORS_RSI_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.connorsRsiOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            seriesRef.current.createPriceLine({
                price: CONNORS_RSI_OVERSOLD_LEVEL,
                color: CHART_COLORS.connorsRsiOversold,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        seriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    useEffect(() => {
        if (!isVisible) return;

        const { connorsRsi } = indicators;
        if (!connorsRsi.length) return;

        if (!seriesRef.current) return;

        seriesRef.current.setData(buildSeriesDataFromValues(bars, connorsRsi));
    }, [indicators, bars, isVisible, paneIndex]);
}
