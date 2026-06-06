'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { VARIANCE_RATIO_RANDOM_WALK_LEVEL } from '../constants/indicatorLevels';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseVarianceRatioChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useVarianceRatioChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseVarianceRatioChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = null;
    });

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

        if (prevPaneIndexRef.current !== paneIndex && seriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!seriesRef.current) {
            seriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.varianceRatioLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            seriesRef.current.createPriceLine({
                price: VARIANCE_RATIO_RANDOM_WALK_LEVEL,
                color: CHART_COLORS.varianceRatioReference,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        seriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { varianceRatio } = indicators;
        if (!varianceRatio.length) return;

        if (!seriesRef.current) return;

        seriesRef.current.setData(
            buildSeriesDataFromValues(bars, varianceRatio)
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
