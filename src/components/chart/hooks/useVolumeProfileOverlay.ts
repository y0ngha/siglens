'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { LineSeries } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

interface UseVolumeProfileOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseVolumeProfileOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useVolumeProfileOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseVolumeProfileOverlayParams): UseVolumeProfileOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const pocSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const vahSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const valSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const clearSeriesRefs = useEffectEvent(() => {
        pocSeriesRef.current = null;
        vahSeriesRef.current = null;
        valSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (pocSeriesRef.current) {
            chart.removeSeries(pocSeriesRef.current);
            pocSeriesRef.current = null;
        }
        if (vahSeriesRef.current) {
            chart.removeSeries(vahSeriesRef.current);
            vahSeriesRef.current = null;
        }
        if (valSeriesRef.current) {
            chart.removeSeries(valSeriesRef.current);
            valSeriesRef.current = null;
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

        const createLineSeries = (color: string) =>
            chart.addSeries(LineSeries, {
                color,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });

        if (!pocSeriesRef.current) {
            pocSeriesRef.current = createLineSeries(CHART_COLORS.vpPoc);
        }

        if (!vahSeriesRef.current) {
            vahSeriesRef.current = createLineSeries(CHART_COLORS.vpVah);
        }

        if (!valSeriesRef.current) {
            valSeriesRef.current = createLineSeries(CHART_COLORS.vpVal);
        }
    }, [chartRef, isVisible, lineWidth]);

    useEffect(() => {
        if (!isVisible) return;

        if (
            !pocSeriesRef.current ||
            !vahSeriesRef.current ||
            !valSeriesRef.current
        )
            return;

        const { volumeProfile } = indicators;

        if (!volumeProfile || bars.length === 0) {
            pocSeriesRef.current.setData([]);
            vahSeriesRef.current.setData([]);
            valSeriesRef.current.setData([]);
            return;
        }

        const { poc, vah, val } = volumeProfile;

        const toLineData = (value: number) =>
            bars.map((bar: Bar) => ({ time: bar.time as UTCTimestamp, value }));

        pocSeriesRef.current.setData(toLineData(poc));
        vahSeriesRef.current.setData(toLineData(vah));
        valSeriesRef.current.setData(toLineData(val));
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
