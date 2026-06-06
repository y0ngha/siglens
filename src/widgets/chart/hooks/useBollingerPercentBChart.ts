'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import {
    BOLLINGER_PERCENT_B_LOWER_LEVEL,
    BOLLINGER_PERCENT_B_UPPER_LEVEL,
} from '../constants/indicatorLevels';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseBollingerPercentBChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useBollingerPercentBChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseBollingerPercentBChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // 이전 chart는 부모가 소멸시키므로 removeSeries 없이 ref만 초기화하면 충분.
    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
        }
    });

    // 데이터 세팅은 아래 effect에서 단독 처리하므로 이 effect는 lifecycle(생성·제거)만 담당.
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

        if (prevPaneIndexRef.current !== paneIndex && seriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!seriesRef.current) {
            seriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.bollingerPercentBLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            seriesRef.current.createPriceLine({
                price: BOLLINGER_PERCENT_B_UPPER_LEVEL,
                color: CHART_COLORS.bollingerPercentBUpper,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            seriesRef.current.createPriceLine({
                price: BOLLINGER_PERCENT_B_LOWER_LEVEL,
                color: CHART_COLORS.bollingerPercentBLower,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        seriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // bollingerDerived는 객체 배열이므로 pctB 값만 추출해 단순 값 배열로 변환
    useEffect(() => {
        if (!isVisible) return;

        const { bollingerDerived } = indicators;
        if (!bollingerDerived.length) return;

        if (!seriesRef.current) return;

        const pctB = bollingerDerived.map(d => d.pctB);
        seriesRef.current.setData(buildSeriesDataFromValues(bars, pctB));
    }, [indicators, bars, isVisible, paneIndex]);
}
