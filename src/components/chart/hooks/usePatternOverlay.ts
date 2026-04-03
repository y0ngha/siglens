'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { RefObject } from 'react';
import {
    AreaSeries,
    LineSeries,
    createSeriesMarkers,
} from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    ISeriesMarkersPluginApi,
    UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, PatternResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

interface UsePatternOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
    bars: Bar[];
    patterns: PatternResult[];
}

interface UsePatternOverlayReturn {
    visiblePatterns: Set<string>;
    togglePattern: (patternName: string) => void;
}

type VisiblePatternsAction =
    | { type: 'reset'; detected: Set<string> }
    | { type: 'toggle'; patternName: string };

const visiblePatternsReducer = (
    state: Set<string>,
    action: VisiblePatternsAction
): Set<string> => {
    if (action.type === 'reset') return action.detected;
    const next = new Set(state);
    if (next.has(action.patternName)) {
        next.delete(action.patternName);
    } else {
        next.add(action.patternName);
    }
    return next;
};

const isDetectedAndVisible = (p: PatternResult): boolean =>
    p.detected && (p.renderConfig?.show ?? false);

/**
 * PatternResult 배열을 받아 detected === true이고 renderConfig.show === true인 패턴을 차트에 렌더링한다.
 * renderConfig.type에 따라 line / marker / region 타입을 구분하여 처리한다.
 * - line: keyPrices의 각 값을 수평선으로 표시한다 (복수 keyPrices 지원).
 * - marker: 캔들스틱 시리즈 위에 마커 플러그인으로 표시한다.
 * - region: AreaSeries로 keyPrices[0]~keyPrices[1] 사이의 구간을 표시한다.
 */
export function usePatternOverlay({
    chartRef,
    seriesRef,
    bars,
    patterns,
}: UsePatternOverlayParams): UsePatternOverlayReturn {
    const [visiblePatterns, dispatch] = useReducer(
        visiblePatternsReducer,
        patterns,
        initial =>
            new Set(
                initial.filter(isDetectedAndVisible).map(p => p.patternName)
            )
    );
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<
        Map<string, (ISeriesApi<'Line'> | ISeriesApi<'Area'>)[]>
    >(new Map());
    const markerPluginMapRef = useRef<
        Map<string, ISeriesMarkersPluginApi<UTCTimestamp>>
    >(new Map());

    const detectedPatterns = useMemo(
        () => patterns.filter(isDetectedAndVisible),
        [patterns]
    );

    const togglePattern = useCallback((patternName: string) => {
        dispatch({ type: 'toggle', patternName });
    }, []);

    useEffect(() => {
        const detected = new Set(detectedPatterns.map(p => p.patternName));
        dispatch({ type: 'reset', detected });
    }, [detectedPatterns]);

    // 시리즈 lifecycle 관리 (생성/제거)
    // chartRef는 RefObject로 동일 참조를 유지하므로 dependency에 포함해도 교체를 감지하지 않는다.
    // chart 인스턴스 교체는 prevChartRef 비교로 감지한다.
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            // chart 인스턴스 교체 시 ref만 초기화
            seriesMapRef.current = new Map();
            markerPluginMapRef.current = new Map();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        // visiblePatterns에서 제거된 시리즈 삭제
        for (const [name, seriesList] of seriesMapRef.current.entries()) {
            if (!visiblePatterns.has(name)) {
                for (const s of seriesList) {
                    chart.removeSeries(s);
                }
                seriesMapRef.current.delete(name);
            }
        }

        // visiblePatterns에서 제거된 marker plugin 삭제
        for (const [name, plugin] of markerPluginMapRef.current.entries()) {
            if (!visiblePatterns.has(name)) {
                plugin.detach();
                markerPluginMapRef.current.delete(name);
            }
        }

        // 새로 표시해야 하는 패턴 시리즈 추가
        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;

            const config = pattern.renderConfig;
            if (!config) continue;

            if (config.type === 'line') {
                if (seriesMapRef.current.has(pattern.patternName)) continue;

                const keyPrices = pattern.keyPrices ?? [];
                if (keyPrices.length === 0) continue;

                const seriesList: ISeriesApi<'Line'>[] = keyPrices.map(
                    (_price, i) =>
                        chart.addSeries(LineSeries, {
                            color: config.color,
                            lineWidth: DEFAULT_LINE_WIDTH,
                            priceLineVisible: false,
                            lastValueVisible: false,
                            title: i === 0 ? config.label : '',
                        })
                );
                seriesMapRef.current.set(pattern.patternName, seriesList);
            } else if (config.type === 'marker') {
                if (markerPluginMapRef.current.has(pattern.patternName))
                    continue;
                if (!seriesRef.current) continue;
                // ISeriesApi defaults to Time (string|number|BusinessDay) but
                // createSeriesMarkers needs a matching HorzScaleItem; at runtime
                // all bars use UTCTimestamp (number), so the cast is safe.
                const plugin = createSeriesMarkers(
                    seriesRef.current as unknown as ISeriesApi<
                        'Candlestick',
                        UTCTimestamp
                    >,
                    []
                );
                markerPluginMapRef.current.set(pattern.patternName, plugin);
            } else if (config.type === 'region') {
                if (seriesMapRef.current.has(pattern.patternName)) continue;
                const kp = pattern.keyPrices ?? [];
                if (kp.length < 2) continue;
                const series = chart.addSeries(AreaSeries, {
                    topColor: config.color,
                    bottomColor: `${config.color}33`,
                    lineColor: config.color,
                    lineWidth: DEFAULT_LINE_WIDTH,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    title: config.label,
                });
                seriesMapRef.current.set(pattern.patternName, [series]);
            }
        }
        // chartRef(RefObject)는 항상 동일 참조를 유지하므로 이 dependency는
        // 실제로 chart 교체를 감지하지 않는다. chart 교체 감지는 prevChartRef 비교로 처리한다.
    }, [chartRef, seriesRef, visiblePatterns, detectedPatterns]);

    // 데이터 동기화
    useEffect(() => {
        if (bars.length === 0) return;

        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;

            const config = pattern.renderConfig;
            if (!config) continue;

            if (config.type === 'line') {
                const seriesList = seriesMapRef.current.get(
                    pattern.patternName
                );
                if (!seriesList) continue;

                const keyPrices = pattern.keyPrices ?? [];
                for (const [i, series] of seriesList.entries()) {
                    const price = keyPrices[i];
                    if (price === undefined) continue;
                    const lineData = bars.map(bar => ({
                        time: bar.time as UTCTimestamp,
                        value: price,
                    }));
                    (series as ISeriesApi<'Line'>).setData(lineData);
                }
            } else if (config.type === 'marker') {
                const plugin = markerPluginMapRef.current.get(
                    pattern.patternName
                );
                if (!plugin) continue;
                const { timeRange, keyPrices: kp = [] } = pattern;
                if (!timeRange || kp.length === 0) continue;
                plugin.setMarkers([
                    {
                        time: timeRange.start as UTCTimestamp,
                        position: 'aboveBar',
                        color: config.color,
                        shape: 'arrowDown',
                        text: config.label,
                    },
                ]);
            } else if (config.type === 'region') {
                const seriesList = seriesMapRef.current.get(
                    pattern.patternName
                );
                if (!seriesList || seriesList.length === 0) continue;
                const { timeRange, keyPrices: kp = [] } = pattern;
                if (!timeRange || kp.length < 2) continue;
                const upper = Math.max(kp[0], kp[1]);
                const regionData = bars
                    .filter(
                        bar =>
                            bar.time >= timeRange.start &&
                            bar.time <= timeRange.end
                    )
                    .map(bar => ({
                        time: bar.time as UTCTimestamp,
                        value: upper,
                    }));
                if (regionData.length > 0) {
                    (seriesList[0] as ISeriesApi<'Area'>).setData(regionData);
                }
            }
        }
    }, [bars, detectedPatterns, visiblePatterns]);

    return { visiblePatterns, togglePattern };
}
