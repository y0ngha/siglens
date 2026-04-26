'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/chartColors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import {
    STOCH_RSI_OVERBOUGHT_LEVEL,
    STOCH_RSI_OVERSOLD_LEVEL,
} from '@y0ngha/siglens-core';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

interface UseStochRSIChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useStochRSIChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseStochRSIChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const kSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const dSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        kSeriesRef.current = null;
        dSeriesRef.current = null;
    });

    // isVisible false 또는 paneIndex 변경 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (kSeriesRef.current) {
            chart.removeSeries(kSeriesRef.current);
            kSeriesRef.current = null;
        }
        if (dSeriesRef.current) {
            chart.removeSeries(dSeriesRef.current);
            dSeriesRef.current = null;
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
        if (prevPaneIndexRef.current !== paneIndex && kSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!kSeriesRef.current) {
            kSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.stochRsiK,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            kSeriesRef.current.createPriceLine({
                price: STOCH_RSI_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.stochRsiOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            kSeriesRef.current.createPriceLine({
                price: STOCH_RSI_OVERSOLD_LEVEL,
                color: CHART_COLORS.stochRsiOversold,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }

        if (!dSeriesRef.current) {
            dSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.stochRsiD,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }

        kSeriesRef.current.applyOptions({ lineWidth });
        dSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { stochRsi } = indicators;
        if (!stochRsi.length) return;

        if (!kSeriesRef.current || !dSeriesRef.current) return;

        const kData = buildSeriesData(bars, stochRsi, 'k');
        const dData = buildSeriesData(bars, stochRsi, 'd');

        kSeriesRef.current.setData(kData);
        dSeriesRef.current.setData(dData);
    }, [indicators, bars, isVisible, paneIndex]);
}
