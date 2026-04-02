'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { AreaSeries, LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult, IchimokuResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

interface UseIchimokuOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseIchimokuOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

interface IchimokuCloudPoint {
    tenkan: number | null;
    kijun: number | null;
    cloudUpper: number | null;
    cloudLower: number | null;
    chikou: number | null;
}

function buildCloudData(ichimoku: IchimokuResult[]): IchimokuCloudPoint[] {
    return ichimoku.map(point => {
        const { senkouA, senkouB } = point;
        const cloudUpper =
            senkouA !== null && senkouB !== null
                ? Math.max(senkouA, senkouB)
                : null;
        const cloudLower =
            senkouA !== null && senkouB !== null
                ? Math.min(senkouA, senkouB)
                : null;
        return {
            tenkan: point.tenkan,
            kijun: point.kijun,
            cloudUpper,
            cloudLower,
            chikou: point.chikou,
        };
    });
}

export function useIchimokuOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseIchimokuOverlayParams): UseIchimokuOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const tenkanRef = useRef<ISeriesApi<'Line'> | null>(null);
    const kijunRef = useRef<ISeriesApi<'Line'> | null>(null);
    const chikouRef = useRef<ISeriesApi<'Line'> | null>(null);
    const cloudUpperRef = useRef<ISeriesApi<'Area'> | null>(null);
    const cloudLowerRef = useRef<ISeriesApi<'Area'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const clearSeriesRefs = useEffectEvent(() => {
        tenkanRef.current = null;
        kijunRef.current = null;
        chikouRef.current = null;
        cloudUpperRef.current = null;
        cloudLowerRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (tenkanRef.current) {
            chart.removeSeries(tenkanRef.current);
            tenkanRef.current = null;
        }
        if (kijunRef.current) {
            chart.removeSeries(kijunRef.current);
            kijunRef.current = null;
        }
        if (chikouRef.current) {
            chart.removeSeries(chikouRef.current);
            chikouRef.current = null;
        }
        if (cloudUpperRef.current) {
            chart.removeSeries(cloudUpperRef.current);
            cloudUpperRef.current = null;
        }
        if (cloudLowerRef.current) {
            chart.removeSeries(cloudLowerRef.current);
            cloudLowerRef.current = null;
        }
    });

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

        if (!cloudUpperRef.current) {
            cloudUpperRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.ichimokuCloudBullish,
                bottomColor: CHART_COLORS.ichimokuCloudBullish,
                lineColor: CHART_COLORS.ichimokuSenkouA,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        cloudUpperRef.current.applyOptions({ lineWidth });

        if (!cloudLowerRef.current) {
            cloudLowerRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.background,
                bottomColor: CHART_COLORS.background,
                lineColor: CHART_COLORS.ichimokuSenkouB,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        cloudLowerRef.current.applyOptions({ lineWidth });

        if (!tenkanRef.current) {
            tenkanRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.ichimokuTenkan,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        tenkanRef.current.applyOptions({ lineWidth });

        if (!kijunRef.current) {
            kijunRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.ichimokuKijun,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        kijunRef.current.applyOptions({ lineWidth });

        if (!chikouRef.current) {
            chikouRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.ichimokuChikou,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
                lineStyle: LineStyle.Dashed,
            });
        }
        chikouRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    useEffect(() => {
        if (!isVisible) return;

        const { ichimoku } = indicators;
        if (!ichimoku.length) return;

        if (
            !tenkanRef.current ||
            !kijunRef.current ||
            !chikouRef.current ||
            !cloudUpperRef.current ||
            !cloudLowerRef.current
        )
            return;

        const cloudData = buildCloudData(ichimoku);

        const tenkanData = buildSeriesData(bars, cloudData, 'tenkan');
        const kijunData = buildSeriesData(bars, cloudData, 'kijun');
        const chikouData = buildSeriesData(bars, cloudData, 'chikou');
        const cloudUpperData = buildSeriesData(bars, cloudData, 'cloudUpper');
        const cloudLowerData = buildSeriesData(bars, cloudData, 'cloudLower');

        tenkanRef.current.setData(tenkanData);
        kijunRef.current.setData(kijunData);
        chikouRef.current.setData(chikouData);
        cloudUpperRef.current.setData(cloudUpperData);
        cloudLowerRef.current.setData(cloudLowerData);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
