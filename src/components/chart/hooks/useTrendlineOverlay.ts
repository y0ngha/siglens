'use client';

import { useEffect, useEffectEvent, useReducer, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { Bar, Trendline } from '@/domain/types';
import { extendTrendline } from '@/domain/analysis/trendline';
import {
    DEFAULT_LINE_WIDTH,
    TRENDLINE_DIRECTION_COLOR,
    TRENDLINE_DIRECTION_LABEL,
} from '@/components/chart/constants';

interface UseTrendlineOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    trendlines: Trendline[];
}

type VisibleTrendlinesAction =
    | { type: 'reset'; indices: Set<number> }
    | { type: 'toggle'; index: number };

const visibleTrendlinesReducer = (
    state: Set<number>,
    action: VisibleTrendlinesAction
): Set<number> => {
    if (action.type === 'reset') return action.indices;
    const next = new Set(state);
    if (next.has(action.index)) {
        next.delete(action.index);
    } else {
        next.add(action.index);
    }
    return next;
};

export function useTrendlineOverlay({
    chartRef,
    bars,
    trendlines,
}: UseTrendlineOverlayParams): void {
    const [visibleTrendlines, dispatch] = useReducer(
        visibleTrendlinesReducer,
        trendlines,
        initial => new Set(initial.map((_, i) => i))
    );

    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<number, ISeriesApi<'Line'>>>(new Map());

    const clearSeriesRefs = useEffectEvent(() => {
        seriesMapRef.current = new Map();
    });

    useEffect(() => {
        const indices = new Set(trendlines.map((_, i) => i));
        dispatch({ type: 'reset', indices });
    }, [trendlines]);

    // 시리즈 lifecycle 관리
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        // visibleTrendlines에서 제거된 시리즈 삭제
        for (const [index, series] of seriesMapRef.current.entries()) {
            if (!visibleTrendlines.has(index)) {
                chart.removeSeries(series);
                seriesMapRef.current.delete(index);
            }
        }

        // 새로 표시해야 하는 추세선 시리즈 추가
        for (const [index, trendline] of trendlines.entries()) {
            if (!visibleTrendlines.has(index)) continue;
            if (seriesMapRef.current.has(index)) continue;

            const series = chart.addSeries(LineSeries, {
                color: TRENDLINE_DIRECTION_COLOR[trendline.direction],
                lineWidth: DEFAULT_LINE_WIDTH,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
                title: TRENDLINE_DIRECTION_LABEL[trendline.direction],
            });
            seriesMapRef.current.set(index, series);
        }
    }, [chartRef, visibleTrendlines, trendlines]);

    // 데이터 동기화
    useEffect(() => {
        if (bars.length === 0) return;

        const lastBar = bars[bars.length - 1];

        for (const [index, trendline] of trendlines.entries()) {
            if (!visibleTrendlines.has(index)) continue;

            const series = seriesMapRef.current.get(index);
            if (!series) continue;

            const extended = extendTrendline(trendline, lastBar.time);

            const lineData = [
                {
                    time: trendline.start.time as UTCTimestamp,
                    value: trendline.start.price,
                },
                {
                    time: trendline.end.time as UTCTimestamp,
                    value: trendline.end.price,
                },
                {
                    time: extended.time as UTCTimestamp,
                    value: extended.price,
                },
            ];

            series.setData(lineData);
        }
    }, [bars, trendlines, visibleTrendlines]);
}
