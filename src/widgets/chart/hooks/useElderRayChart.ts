'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { HistogramSeries } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { buildSeriesData } from '../utils/seriesDataUtils';
import { elderRayBarColor } from '../utils/histogramColorUtils';

interface UseElderRayChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    isVisible: boolean;
    paneIndex: number;
}

export function useElderRayChart({
    chartRef,
    bars,
    indicators,
    isVisible,
    paneIndex,
}: UseElderRayChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const bullSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const bearSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        bullSeriesRef.current = null;
        bearSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (bullSeriesRef.current) {
            chart.removeSeries(bullSeriesRef.current);
            bullSeriesRef.current = null;
        }
        if (bearSeriesRef.current) {
            chart.removeSeries(bearSeriesRef.current);
            bearSeriesRef.current = null;
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

        if (prevPaneIndexRef.current !== paneIndex && bullSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!bullSeriesRef.current) {
            bullSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
        if (!bearSeriesRef.current) {
            bearSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
    }, [chartRef, isVisible, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { elderRay } = indicators;
        if (!elderRay.length) return;

        if (!bullSeriesRef.current || !bearSeriesRef.current) return;

        bullSeriesRef.current.setData(
            buildSeriesData(bars, elderRay, 'bullPower', value =>
                elderRayBarColor(value, 'bull')
            )
        );
        bearSeriesRef.current.setData(
            buildSeriesData(bars, elderRay, 'bearPower', value =>
                elderRayBarColor(value, 'bear')
            )
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
