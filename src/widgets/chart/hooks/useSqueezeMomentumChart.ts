'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { HistogramSeries, LineSeries } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_POINT_MARKERS_RADIUS } from '../constants';
import { buildSeriesData, buildZeroLineDots } from '../utils/seriesDataUtils';
import {
    squeezeMomentumColor,
    squeezeStateColor,
} from '../utils/histogramColorUtils';

interface UseSqueezeMomentumChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    isVisible: boolean;
    paneIndex: number;
}

export function useSqueezeMomentumChart({
    chartRef,
    bars,
    indicators,
    isVisible,
    paneIndex,
}: UseSqueezeMomentumChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const momentumSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const stateDotsSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        momentumSeriesRef.current = null;
        stateDotsSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (momentumSeriesRef.current) {
            chart.removeSeries(momentumSeriesRef.current);
            momentumSeriesRef.current = null;
        }
        if (stateDotsSeriesRef.current) {
            chart.removeSeries(stateDotsSeriesRef.current);
            stateDotsSeriesRef.current = null;
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

        if (
            prevPaneIndexRef.current !== paneIndex &&
            momentumSeriesRef.current
        ) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!momentumSeriesRef.current) {
            momentumSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
        if (!stateDotsSeriesRef.current) {
            stateDotsSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    lineVisible: false,
                    pointMarkersVisible: true,
                    pointMarkersRadius: DEFAULT_POINT_MARKERS_RADIUS,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }
    }, [chartRef, isVisible, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { squeezeMomentum } = indicators;
        if (!squeezeMomentum.length) return;

        if (!momentumSeriesRef.current || !stateDotsSeriesRef.current) return;

        momentumSeriesRef.current.setData(
            buildSeriesData(bars, squeezeMomentum, 'momentum', (value, row) =>
                squeezeMomentumColor(value, row.increasing)
            )
        );
        stateDotsSeriesRef.current.setData(
            buildZeroLineDots(bars, squeezeMomentum, squeezeStateColor)
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
