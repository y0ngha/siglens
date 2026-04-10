'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import type { Bar } from '@/domain/types';
import type { ValidatedActionPrices } from '@/domain/analysis/actionRecommendation';
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

interface UseActionRecommendationOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    actionPrices: ValidatedActionPrices | undefined;
    isVisible: boolean;
    lineWidth?: LineWidth;
}

export function useActionRecommendationOverlay({
    chartRef,
    bars,
    actionPrices,
    isVisible,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseActionRecommendationOverlayParams): void {
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

        if (!isVisible || !actionPrices) return;

        const entryEntries = actionPrices.entryPrices.map(price => ({
            series: createLevelSeries(
                chart,
                CHART_COLORS.actionEntry,
                lineWidth
            ),
            price,
        }));

        const stopLossEntries =
            actionPrices.stopLoss !== undefined
                ? [
                      {
                          series: createLevelSeries(
                              chart,
                              CHART_COLORS.actionStopLoss,
                              lineWidth
                          ),
                          price: actionPrices.stopLoss,
                      },
                  ]
                : [];

        const takeProfitEntries = actionPrices.takeProfitPrices.map(price => ({
            series: createLevelSeries(
                chart,
                CHART_COLORS.actionTakeProfit,
                lineWidth
            ),
            price,
        }));

        entriesRef.current = [
            ...entryEntries,
            ...stopLossEntries,
            ...takeProfitEntries,
        ];
    }, [actionPrices, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/actionPrices 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        for (const { series, price } of entriesRef.current) {
            series.setData(buildLineData(bars, price));
        }
    }, [bars, actionPrices, isVisible]);
}
