'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH, STORAGE_KEYS } from '../constants';
import { buildTrendSplitData } from '../utils/seriesDataUtils';

interface UseSupertrendOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseSupertrendOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useSupertrendOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseSupertrendOverlayParams): UseSupertrendOverlayReturn {
    const prevChartRef = useRef<IChartApi | null>(null);
    const upSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const downSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const [isVisible, setIsVisible] = usePersistentState(
        STORAGE_KEYS.overlay('supertrend'),
        false
    );

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, [setIsVisible]);

    const clearSeriesRefs = useEffectEvent(() => {
        upSeriesRef.current = null;
        downSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (upSeriesRef.current) {
            chart.removeSeries(upSeriesRef.current);
            upSeriesRef.current = null;
        }
        if (downSeriesRef.current) {
            chart.removeSeries(downSeriesRef.current);
            downSeriesRef.current = null;
        }
    });

    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당.
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태.
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

        if (!upSeriesRef.current) {
            upSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.supertrendUp,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        upSeriesRef.current.applyOptions({ lineWidth });

        if (!downSeriesRef.current) {
            downSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.supertrendDown,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        downSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { supertrend } = indicators;
        if (!supertrend.length) return;

        if (!upSeriesRef.current || !downSeriesRef.current) return;

        upSeriesRef.current.setData(
            buildTrendSplitData(bars, supertrend, 'up', r => r.supertrend)
        );
        downSeriesRef.current.setData(
            buildTrendSplitData(bars, supertrend, 'down', r => r.supertrend)
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
