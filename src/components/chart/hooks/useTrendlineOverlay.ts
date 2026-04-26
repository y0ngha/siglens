'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { Bar, Trendline } from '@/domain/types';
import { extendTrendline } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import {
    TRENDLINE_DIRECTION_COLOR,
    TRENDLINE_DIRECTION_LABEL,
} from '@/components/trendline/constants';
import {
    resolveTrendlinePrice,
    trendlineKey,
} from '@/components/chart/utils/trendlineUtils';

const MIN_TRENDLINE_POINTS = 2;
const EXTENSION_BARS = 20;

function calcExtendedTarget(bars: Bar[]): number {
    if (bars.length < 2) return bars[bars.length - 1]?.time ?? 0;
    const interval = bars[bars.length - 1].time - bars[bars.length - 2].time;
    return bars[bars.length - 1].time + interval * EXTENSION_BARS;
}

interface UseTrendlineOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    trendlines: Trendline[];
    isVisible: boolean;
}

export function useTrendlineOverlay({
    chartRef,
    bars,
    trendlines,
    isVisible,
}: UseTrendlineOverlayParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    const barsMapRef = useRef<Map<number, Bar>>(new Map());

    const clearSeriesRefs = useEffectEvent(() => {
        seriesMapRef.current = new Map();
    });

    // useLayoutEffect: 렌더 후 useEffect보다 먼저 실행되어 데이터 동기화 effect에서 최신 bars를 참조할 수 있다.
    useLayoutEffect(() => {
        barsMapRef.current = new Map(bars.map(bar => [bar.time, bar]));
    }, [bars]);

    // 시리즈 lifecycle 관리
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        // 숨김 상태: 기존 시리즈 모두 제거
        if (!isVisible) {
            for (const series of seriesMapRef.current.values()) {
                chart.removeSeries(series);
            }
            seriesMapRef.current = new Map();
            return;
        }

        const activeKeys = new Set(trendlines.map(trendlineKey));

        // 현재 trendlines에 없는 시리즈 삭제
        for (const [key, series] of seriesMapRef.current.entries()) {
            if (!activeKeys.has(key)) {
                chart.removeSeries(series);
                seriesMapRef.current.delete(key);
            }
        }

        // 새로 표시해야 하는 추세선 시리즈 추가
        for (const trendline of trendlines) {
            const key = trendlineKey(trendline);
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
    }, [chartRef, trendlines, isVisible]);

    // 데이터 동기화
    useEffect(() => {
        if (!isVisible || bars.length === 0) return;

        const extendedTarget = calcExtendedTarget(bars);

        for (const trendline of trendlines) {
            const key = trendlineKey(trendline);
            const series = seriesMapRef.current.get(key);
            if (!series) continue;

            // 상승 추세선은 저가, 하락 추세선은 고가로 스냅
            const startPrice = resolveTrendlinePrice(
                barsMapRef.current.get(trendline.start.time),
                trendline.direction,
                trendline.start.price
            );
            const endPrice = resolveTrendlinePrice(
                barsMapRef.current.get(trendline.end.time),
                trendline.direction,
                trendline.end.price
            );

            const resolvedTrendline: Trendline = {
                direction: trendline.direction,
                start: { time: trendline.start.time, price: startPrice },
                end: { time: trendline.end.time, price: endPrice },
            };

            const extended = extendTrendline(resolvedTrendline, extendedTarget);

            // lightweight-charts는 타임스탬프가 엄격하게 오름차순이어야 하므로 정렬 및 중복 제거
            const basePoints = [
                {
                    time: resolvedTrendline.start.time as UTCTimestamp,
                    value: startPrice,
                },
                {
                    time: resolvedTrendline.end.time as UTCTimestamp,
                    value: endPrice,
                },
            ].sort((a, b) => a.time - b.time);

            const allPoints =
                extended.time > basePoints[basePoints.length - 1].time
                    ? [
                          ...basePoints,
                          {
                              time: extended.time as UTCTimestamp,
                              value: extended.price,
                          },
                      ]
                    : basePoints;

            const uniqueData = allPoints.filter(
                (p, i, arr) => i === 0 || p.time > arr[i - 1].time
            );

            if (uniqueData.length >= MIN_TRENDLINE_POINTS) {
                series.setData(uniqueData);
            }
        }
    }, [bars, trendlines, isVisible]);
}
