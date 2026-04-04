'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { Bar, Trendline } from '@/domain/types';
import { extendTrendline } from '@/domain/analysis/trendline';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import {
    TRENDLINE_DIRECTION_COLOR,
    TRENDLINE_DIRECTION_LABEL,
} from '@/components/trendline/constants';

interface UseTrendlineOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    trendlines: Trendline[];
}

export function useTrendlineOverlay({
    chartRef,
    bars,
    trendlines,
}: UseTrendlineOverlayParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    const clearSeriesRefs = useEffectEvent(() => {
        seriesMapRef.current = new Map();
    });

    // 시리즈 lifecycle 관리
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        const activeKeys = new Set(
            trendlines.map(t => `${t.direction}:${t.start.time}:${t.end.time}`)
        );

        // 현재 trendlines에 없는 시리즈 삭제
        for (const [key, series] of seriesMapRef.current.entries()) {
            if (!activeKeys.has(key)) {
                chart.removeSeries(series);
                seriesMapRef.current.delete(key);
            }
        }

        // 새로 표시해야 하는 추세선 시리즈 추가
        for (const trendline of trendlines) {
            const key = `${trendline.direction}:${trendline.start.time}:${trendline.end.time}`;
            if (seriesMapRef.current.has(key)) continue;

            const series = chart.addSeries(LineSeries, {
                color: TRENDLINE_DIRECTION_COLOR[trendline.direction],
                lineWidth: DEFAULT_LINE_WIDTH,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
                title: TRENDLINE_DIRECTION_LABEL[trendline.direction],
            });
            seriesMapRef.current.set(key, series);
        }
    }, [chartRef, trendlines]);

    // 데이터 동기화
    useEffect(() => {
        if (bars.length === 0) return;

        const lastBar = bars[bars.length - 1];

        for (const trendline of trendlines) {
            const key = `${trendline.direction}:${trendline.start.time}:${trendline.end.time}`;
            const series = seriesMapRef.current.get(key);
            if (!series) continue;

            const extended = extendTrendline(trendline, lastBar.time);

            // lightweight-charts는 타임스탬프가 엄격하게 오름차순이어야 하므로 정렬 및 중복 제거
            const points = [
                {
                    time: trendline.start.time as UTCTimestamp,
                    value: trendline.start.price,
                },
                {
                    time: trendline.end.time as UTCTimestamp,
                    value: trendline.end.price,
                },
            ].sort((a, b) => a.time - b.time);

            if (extended.time > points[points.length - 1].time) {
                points.push({
                    time: extended.time as UTCTimestamp,
                    value: extended.price,
                });
            }

            const uniqueData = points.filter(
                (p, i, arr) => i === 0 || p.time > arr[i - 1].time
            );

            if (uniqueData.length >= 2) {
                series.setData(uniqueData);
            }
        }
    }, [bars, trendlines]);
}
