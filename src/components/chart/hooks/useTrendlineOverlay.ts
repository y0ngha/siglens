'use client';

import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
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
import { trendlineKey } from '@/components/chart/utils/trendlineUtils';

interface UseTrendlineOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    trendlines: Trendline[];
}

/**
 * 추세선의 기준 가격을 실제 바 데이터에서 조회한다.
 * 상승 추세선은 저가(low), 하락 추세선은 고가(high)를 사용한다.
 * 해당 타임스탬프의 바가 없으면 AI가 제공한 가격을 그대로 사용한다.
 */
function resolveTrendlinePrice(
    bar: Bar | undefined,
    direction: Trendline['direction'],
    fallback: number
): number {
    if (!bar) return fallback;
    return direction === 'ascending' ? bar.low : bar.high;
}

export function useTrendlineOverlay({
    chartRef,
    bars,
    trendlines,
}: UseTrendlineOverlayParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    const barsMap = useMemo(
        () => new Map(bars.map(bar => [bar.time, bar])),
        [bars]
    );

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
    }, [chartRef, trendlines]);

    // 데이터 동기화
    useEffect(() => {
        if (bars.length === 0) return;

        const lastBar = bars[bars.length - 1];

        for (const trendline of trendlines) {
            const key = trendlineKey(trendline);
            const series = seriesMapRef.current.get(key);
            if (!series) continue;

            // 실제 바 데이터에서 가격 조회: 상승 추세선은 저가, 하락 추세선은 고가 사용
            const startPrice = resolveTrendlinePrice(
                barsMap.get(trendline.start.time),
                trendline.direction,
                trendline.start.price
            );
            const endPrice = resolveTrendlinePrice(
                barsMap.get(trendline.end.time),
                trendline.direction,
                trendline.end.price
            );

            // 실제 바 가격으로 보정된 추세선 데이터
            const resolvedTrendline: Trendline = {
                direction: trendline.direction,
                start: { time: trendline.start.time, price: startPrice },
                end: { time: trendline.end.time, price: endPrice },
            };

            const extended = extendTrendline(resolvedTrendline, lastBar.time);

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

            if (uniqueData.length >= 2) {
                series.setData(uniqueData);
            }
        }
    }, [bars, barsMap, trendlines]);
}
