'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import type { Bar, KeyLevels } from '@/domain/types';
import { CHART_COLORS } from '@/lib/colors';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { addLevelSeries } from '@/components/chart/utils/keyLevelsUtils';

interface UseKeyLevelsOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    keyLevels: KeyLevels;
    isVisible: boolean;
    lineWidth?: LineWidth;
}

export function useKeyLevelsOverlay({
    chartRef,
    bars,
    keyLevels,
    isVisible,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseKeyLevelsOverlayParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);

    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = [];
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        for (const series of seriesRef.current) {
            chart.removeSeries(series);
        }
        seriesRef.current = [];
    });

    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        removeAllSeries(chart);

        if (!isVisible) return;

        const supportSeries = keyLevels.support.map(level =>
            addLevelSeries(
                chart,
                bars,
                level.price,
                CHART_COLORS.supportLine,
                lineWidth
            )
        );
        const resistanceSeries = keyLevels.resistance.map(level =>
            addLevelSeries(
                chart,
                bars,
                level.price,
                CHART_COLORS.resistanceLine,
                lineWidth
            )
        );
        const pocSeries =
            keyLevels.poc !== undefined
                ? [
                      addLevelSeries(
                          chart,
                          bars,
                          keyLevels.poc.price,
                          CHART_COLORS.vpPoc,
                          lineWidth
                      ),
                  ]
                : [];

        seriesRef.current = [
            ...supportSeries,
            ...resistanceSeries,
            ...pocSeries,
        ];
    }, [chartRef, bars, keyLevels, isVisible, lineWidth]);
}
