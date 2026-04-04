'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/lib/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
} from '@/domain/indicators/constants';
import { buildSeriesDataFromValues } from '@/components/chart/utils/seriesDataUtils';

interface UseRSIChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useRSIChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseRSIChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        rsiSeriesRef.current = null;
    });

    // isVisible false 또는 paneIndex 변경 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (rsiSeriesRef.current) {
            chart.removeSeries(rsiSeriesRef.current);
            rsiSeriesRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태
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
        if (prevPaneIndexRef.current !== paneIndex && rsiSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!rsiSeriesRef.current) {
            rsiSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.rsiLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );

            rsiSeriesRef.current.createPriceLine({
                price: RSI_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.rsiOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            rsiSeriesRef.current.createPriceLine({
                price: RSI_OVERSOLD_LEVEL,
                color: CHART_COLORS.rsiOversold,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        rsiSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { rsi } = indicators;
        if (!rsi.length) return;

        if (!rsiSeriesRef.current) return;

        rsiSeriesRef.current.setData(buildSeriesDataFromValues(bars, rsi));
    }, [indicators, bars, isVisible, paneIndex]);
}
