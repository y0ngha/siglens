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
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildTrendSplitData } from '../utils/seriesDataUtils';

interface UseChandelierOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseChandelierOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useChandelierOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseChandelierOverlayParams): UseChandelierOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const longSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const shortSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const clearSeriesRefs = useEffectEvent(() => {
        longSeriesRef.current = null;
        shortSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (longSeriesRef.current) {
            chart.removeSeries(longSeriesRef.current);
            longSeriesRef.current = null;
        }
        if (shortSeriesRef.current) {
            chart.removeSeries(shortSeriesRef.current);
            shortSeriesRef.current = null;
        }
    });

    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당.
    // supertrend(solid)와 구분되도록 LineStyle.Dashed로 그린다.
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

        if (!longSeriesRef.current) {
            longSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.chandelierLong,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        longSeriesRef.current.applyOptions({ lineWidth });

        if (!shortSeriesRef.current) {
            shortSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.chandelierShort,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        shortSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { chandelierExit } = indicators;
        if (!chandelierExit.length) return;

        if (!longSeriesRef.current || !shortSeriesRef.current) return;

        longSeriesRef.current.setData(
            buildTrendSplitData(bars, chandelierExit, 'long', r => r.longStop)
        );
        shortSeriesRef.current.setData(
            buildTrendSplitData(bars, chandelierExit, 'short', r => r.shortStop)
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
