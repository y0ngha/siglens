'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseYangZhangChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useYangZhangChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseYangZhangChartParams): void {
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
                    color: CHART_COLORS.yangZhangLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }
        seriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { yangZhang } = indicators;
        if (!yangZhang.length) return;

        if (!seriesRef.current) return;

        seriesRef.current.setData(buildSeriesDataFromValues(bars, yangZhang));
    }, [indicators, bars, isVisible, paneIndex]);
}
