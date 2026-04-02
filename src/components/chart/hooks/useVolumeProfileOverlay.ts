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
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';

interface UseVolumeProfileOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
}

interface UseVolumeProfileOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useVolumeProfileOverlay({
    chartRef,
    bars,
    indicators,
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

        if (!pocSeriesRef.current) {
            pocSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.vpPoc,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }

        if (!vahSeriesRef.current) {
            vahSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.vpVah,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }

        if (!valSeriesRef.current) {
            valSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.vpVal,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
    }, [chartRef, isVisible]);

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

        const pocData = bars.map(bar => ({
            time: bar.time as UTCTimestamp,
            value: poc,
        }));
        const vahData = bars.map(bar => ({
            time: bar.time as UTCTimestamp,
            value: vah,
        }));
        const valData = bars.map(bar => ({
            time: bar.time as UTCTimestamp,
            value: val,
        }));

        pocSeriesRef.current.setData(pocData);
        vahSeriesRef.current.setData(vahData);
        valSeriesRef.current.setData(valData);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
