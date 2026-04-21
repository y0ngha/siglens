'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import type { Bar, KeyLevels } from '@/domain/types';
import { CHART_COLORS } from '@/lib/chartColors';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import {
    buildLineData,
    createLevelSeries,
} from '@/components/chart/utils/keyLevelsUtils';

interface LevelSeriesEntry {
    series: ISeriesApi<'Line'>;
    price: number;
}

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
    const entriesRef = useRef<LevelSeriesEntry[]>([]);

    const clearEntriesRef = useEffectEvent(() => {
        entriesRef.current = [];
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        for (const { series } of entriesRef.current) {
            chart.removeSeries(series);
        }
        entriesRef.current = [];
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearEntriesRef();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        removeAllSeries(chart);

        if (!isVisible) return;

        const supportEntries = keyLevels.support.map(level => ({
            series: createLevelSeries(
                chart,
                CHART_COLORS.supportLine,
                lineWidth
            ),
            price: level.price,
        }));
        const resistanceEntries = keyLevels.resistance.map(level => ({
            series: createLevelSeries(
                chart,
                CHART_COLORS.resistanceLine,
                lineWidth
            ),
            price: level.price,
        }));
        const pocEntries =
            keyLevels.poc !== undefined
                ? [
                      {
                          series: createLevelSeries(
                              chart,
                              CHART_COLORS.vpPoc,
                              lineWidth
                          ),
                          price: keyLevels.poc.price,
                      },
                  ]
                : [];

        entriesRef.current = [
            ...supportEntries,
            ...resistanceEntries,
            ...pocEntries,
        ];
    }, [chartRef, keyLevels, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/keyLevels 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        for (const { series, price } of entriesRef.current) {
            series.setData(buildLineData(bars, price));
        }
    }, [bars, keyLevels, isVisible]);
}
