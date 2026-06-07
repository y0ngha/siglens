'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { HistogramSeries } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { buildSeriesData } from '../utils/seriesDataUtils';
import { regressionBarColor } from '../utils/histogramColorUtils';

interface UseRegressionChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    isVisible: boolean;
    paneIndex: number;
}

export function useRegressionChart({
    chartRef,
    bars,
    indicators,
    isVisible,
    paneIndex,
}: UseRegressionChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const slopeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        slopeSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (slopeSeriesRef.current) {
            chart.removeSeries(slopeSeriesRef.current);
            slopeSeriesRef.current = null;
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

        if (prevPaneIndexRef.current !== paneIndex && slopeSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!slopeSeriesRef.current) {
            slopeSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
    }, [chartRef, isVisible, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { regression } = indicators;
        if (!regression.length) return;

        if (!slopeSeriesRef.current) return;

        slopeSeriesRef.current.setData(
            buildSeriesData(bars, regression, 'slope', (value, row) =>
                regressionBarColor(value, row.r2)
            )
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
