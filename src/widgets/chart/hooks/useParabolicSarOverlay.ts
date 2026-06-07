'use client';

import type { RefObject } from 'react';
import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildTrendSplitData } from '../utils/seriesDataUtils';

interface UseParabolicSarOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseParabolicSarOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useParabolicSarOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseParabolicSarOverlayParams): UseParabolicSarOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const upSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const downSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

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
    // 가격 위/아래 점(dot)만 렌더하므로 lineVisible:false + pointMarkersVisible:true.
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
                color: CHART_COLORS.parabolicSarUp,
                lineVisible: false,
                pointMarkersVisible: true,
                pointMarkersRadius: 2,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }

        if (!downSeriesRef.current) {
            downSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.parabolicSarDown,
                lineVisible: false,
                pointMarkersVisible: true,
                pointMarkersRadius: 2,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { parabolicSar } = indicators;
        if (!parabolicSar.length) return;

        if (!upSeriesRef.current || !downSeriesRef.current) return;

        upSeriesRef.current.setData(
            buildTrendSplitData(bars, parabolicSar, 'up', r => r.sar)
        );
        downSeriesRef.current.setData(
            buildTrendSplitData(bars, parabolicSar, 'down', r => r.sar)
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
