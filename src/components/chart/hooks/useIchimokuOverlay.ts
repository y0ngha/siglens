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
import type { Bar, IndicatorResult } from '@/domain/types';
import { calculateIchimokuFutureCloud } from '@/domain/indicators/ichimoku';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';
import {
    buildCloudData,
    extendWithFutureCloud,
} from '@/components/chart/utils/ichimokuUtils';
import type { FutureCloudBase } from '@/components/chart/utils/ichimokuUtils';

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
    const senkouARef = useRef<ISeriesApi<'Line'> | null>(null);
    const senkouBRef = useRef<ISeriesApi<'Line'> | null>(null);
    const cloudBullishRef = useRef<ISeriesApi<'Area'> | null>(null);
    const cloudBearishRef = useRef<ISeriesApi<'Area'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const clearSeriesRefs = useEffectEvent(() => {
        tenkanRef.current = null;
        kijunRef.current = null;
        chikouRef.current = null;
        senkouARef.current = null;
        senkouBRef.current = null;
        cloudBullishRef.current = null;
        cloudBearishRef.current = null;
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
        if (senkouARef.current) {
            chart.removeSeries(senkouARef.current);
            senkouARef.current = null;
        }
        if (senkouBRef.current) {
            chart.removeSeries(senkouBRef.current);
            senkouBRef.current = null;
        }
        if (cloudBullishRef.current) {
            chart.removeSeries(cloudBullishRef.current);
            cloudBullishRef.current = null;
        }
        if (cloudBearishRef.current) {
            chart.removeSeries(cloudBearishRef.current);
            cloudBearishRef.current = null;
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

        if (!cloudBullishRef.current) {
            cloudBullishRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.ichimokuCloudBullish,
                bottomColor: 'transparent',
                lineColor: 'transparent',
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        cloudBullishRef.current.applyOptions({ lineWidth });

        if (!cloudBearishRef.current) {
            cloudBearishRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.ichimokuCloudBearish,
                bottomColor: 'transparent',
                lineColor: 'transparent',
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        cloudBearishRef.current.applyOptions({ lineWidth });

        if (!senkouARef.current) {
            senkouARef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.ichimokuSenkouA,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        senkouARef.current.applyOptions({ lineWidth });

        if (!senkouBRef.current) {
            senkouBRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.ichimokuSenkouB,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        senkouBRef.current.applyOptions({ lineWidth });

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
            !senkouARef.current ||
            !senkouBRef.current ||
            !cloudBullishRef.current ||
            !cloudBearishRef.current
        )
            return;

        const cloudData = buildCloudData(ichimoku);

        const tenkanData = buildSeriesData(bars, cloudData, 'tenkan');
        const kijunData = buildSeriesData(bars, cloudData, 'kijun');
        const chikouData = buildSeriesData(bars, cloudData, 'chikou');
        const senkouAData = buildSeriesData(bars, cloudData, 'senkouA');
        const senkouBData = buildSeriesData(bars, cloudData, 'senkouB');
        const cloudBullishData = buildSeriesData(
            bars,
            cloudData,
            'cloudBullishUpper'
        );
        const cloudBearishData = buildSeriesData(
            bars,
            cloudData,
            'cloudBearishUpper'
        );

        // Append future cloud points projected displacement bars ahead
        const futureCloud = calculateIchimokuFutureCloud(bars);
        const base: FutureCloudBase = {
            senkouAData,
            senkouBData,
            cloudBullishData,
            cloudBearishData,
        };
        const {
            finalSenkouA,
            finalSenkouB,
            finalCloudBullish,
            finalCloudBearish,
        } =
            bars.length >= 2
                ? extendWithFutureCloud(bars, buildCloudData(futureCloud), base)
                : {
                      finalSenkouA: senkouAData,
                      finalSenkouB: senkouBData,
                      finalCloudBullish: cloudBullishData,
                      finalCloudBearish: cloudBearishData,
                  };

        tenkanRef.current.setData(tenkanData);
        kijunRef.current.setData(kijunData);
        chikouRef.current.setData(chikouData);
        senkouARef.current.setData(finalSenkouA);
        senkouBRef.current.setData(finalSenkouB);
        cloudBullishRef.current.setData(finalCloudBullish);
        cloudBearishRef.current.setData(finalCloudBearish);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
