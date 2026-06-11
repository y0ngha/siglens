'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { AreaSeries, LineSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH, STORAGE_KEYS } from '../constants';
import { buildSeriesData } from '../utils/seriesDataUtils';

interface UseKeltnerOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseKeltnerOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useKeltnerOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseKeltnerOverlayParams): UseKeltnerOverlayReturn {
    const prevChartRef = useRef<IChartApi | null>(null);
    const upperSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const middleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lowerSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const [isVisible, setIsVisible] = usePersistentState(
        STORAGE_KEYS.overlay('keltner'),
        false
    );

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, [setIsVisible]);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        upperSeriesRef.current = null;
        middleSeriesRef.current = null;
        lowerSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (upperSeriesRef.current) {
            chart.removeSeries(upperSeriesRef.current);
            upperSeriesRef.current = null;
        }
        if (middleSeriesRef.current) {
            chart.removeSeries(middleSeriesRef.current);
            middleSeriesRef.current = null;
        }
        if (lowerSeriesRef.current) {
            chart.removeSeries(lowerSeriesRef.current);
            lowerSeriesRef.current = null;
        }
    });

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

        if (!upperSeriesRef.current) {
            upperSeriesRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.keltnerBackground,
                bottomColor: CHART_COLORS.keltnerBackground,
                lineColor: CHART_COLORS.keltnerUpper,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        upperSeriesRef.current.applyOptions({ lineWidth });

        if (!middleSeriesRef.current) {
            middleSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.keltnerMiddle,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        middleSeriesRef.current.applyOptions({ lineWidth });

        if (!lowerSeriesRef.current) {
            lowerSeriesRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.background,
                bottomColor: CHART_COLORS.background,
                lineColor: CHART_COLORS.keltnerLower,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        lowerSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { keltnerChannel } = indicators;
        if (!keltnerChannel.length) return;

        if (
            !upperSeriesRef.current ||
            !middleSeriesRef.current ||
            !lowerSeriesRef.current
        )
            return;

        const upperData = buildSeriesData(bars, keltnerChannel, 'upper');
        const middleData = buildSeriesData(bars, keltnerChannel, 'middle');
        const lowerData = buildSeriesData(bars, keltnerChannel, 'lower');

        upperSeriesRef.current.setData(upperData);
        middleSeriesRef.current.setData(middleData);
        lowerSeriesRef.current.setData(lowerData);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
