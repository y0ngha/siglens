'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, KeyLevels } from '@/domain/types';
import { CHART_COLORS } from '@/domain/constants/colors';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

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

        const toLineData = (price: number) =>
            bars.map((bar: Bar) => ({
                time: bar.time as UTCTimestamp,
                value: price,
            }));

        const collected: ISeriesApi<'Line'>[] = [];

        const createSeries = (price: number, color: string): void => {
            const series = chart.addSeries(LineSeries, {
                color,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: true,
            });
            series.setData(toLineData(price));
            collected.push(series);
        };

        for (const level of keyLevels.support) {
            createSeries(level.price, CHART_COLORS.supportLine);
        }

        for (const level of keyLevels.resistance) {
            createSeries(level.price, CHART_COLORS.resistanceLine);
        }

        if (keyLevels.poc !== undefined) {
            createSeries(keyLevels.poc.price, CHART_COLORS.vpPoc);
        }

        seriesRef.current = collected;
    }, [chartRef, bars, keyLevels, isVisible, lineWidth]);
}
