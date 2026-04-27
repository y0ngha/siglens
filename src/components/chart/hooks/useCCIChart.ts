'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/chartColors';
import {
    type Bar,
    type IndicatorResult,
    CCI_OVERBOUGHT_LEVEL,
    CCI_OVERSOLD_LEVEL,
    CCI_ZERO_LEVEL,
} from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesDataFromValues } from '@/components/chart/utils/seriesDataUtils';

interface UseCCIChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useCCIChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseCCIChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const cciSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        cciSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (cciSeriesRef.current) {
            chart.removeSeries(cciSeriesRef.current);
            cciSeriesRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거)
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
        if (prevPaneIndexRef.current !== paneIndex && cciSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!cciSeriesRef.current) {
            cciSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.cciLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            cciSeriesRef.current.createPriceLine({
                price: CCI_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.cciOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            cciSeriesRef.current.createPriceLine({
                price: CCI_OVERSOLD_LEVEL,
                color: CHART_COLORS.cciOversold,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            cciSeriesRef.current.createPriceLine({
                price: CCI_ZERO_LEVEL,
                color: CHART_COLORS.cciZero,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        cciSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // 데이터 동기화
    useEffect(() => {
        if (!isVisible) return;

        const { cci } = indicators;
        if (!cci.length) return;

        if (!cciSeriesRef.current) return;

        cciSeriesRef.current.setData(buildSeriesDataFromValues(bars, cci));
    }, [indicators, bars, isVisible, paneIndex]);
}
