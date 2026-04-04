'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import {
    STOCHASTIC_OVERBOUGHT_LEVEL,
    STOCHASTIC_OVERSOLD_LEVEL,
} from '@/domain/indicators/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

interface UseStochasticChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useStochasticChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseStochasticChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const percentKSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const percentDSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        percentKSeriesRef.current = null;
        percentDSeriesRef.current = null;
    });

    // isVisible false 또는 paneIndex 변경 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (percentKSeriesRef.current) {
            chart.removeSeries(percentKSeriesRef.current);
            percentKSeriesRef.current = null;
        }
        if (percentDSeriesRef.current) {
            chart.removeSeries(percentDSeriesRef.current);
            percentDSeriesRef.current = null;
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
            percentKSeriesRef.current
        ) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!percentKSeriesRef.current) {
            percentKSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.stochasticK,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            percentKSeriesRef.current.createPriceLine({
                price: STOCHASTIC_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.stochasticOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            percentKSeriesRef.current.createPriceLine({
                price: STOCHASTIC_OVERSOLD_LEVEL,
                color: CHART_COLORS.stochasticOversold,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }

        if (!percentDSeriesRef.current) {
            percentDSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.stochasticD,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }

        percentKSeriesRef.current.applyOptions({ lineWidth });
        percentDSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { stochastic } = indicators;
        if (!stochastic.length) return;

        if (!percentKSeriesRef.current || !percentDSeriesRef.current) return;

        const percentKData = buildSeriesData(bars, stochastic, 'percentK');
        const percentDData = buildSeriesData(bars, stochastic, 'percentD');

        percentKSeriesRef.current.setData(percentKData);
        percentDSeriesRef.current.setData(percentDData);
    }, [indicators, bars, isVisible, paneIndex]);
}
