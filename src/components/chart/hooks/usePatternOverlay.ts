'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
    IChartApi,
    ISeriesApi,
    ISeriesMarkersPluginApi,
    UTCTimestamp,
} from 'lightweight-charts';
import { createSeriesMarkers, LineSeries } from 'lightweight-charts';
import type { Bar, PatternLine, PatternResult } from '@/domain/types';
import {
    BASE_PATTERN_SERIES_OPTIONS,
    LABEL_SERIES_INDEX,
    MARKER_POSITION,
    MARKER_SHAPE,
    REGION_KEY_PRICE_MIN_LENGTH,
    REGION_LOWER_PRICE_INDEX,
    REGION_UPPER_PRICE_INDEX,
} from '@/components/chart/constants';
import type { VisiblePatternResult } from '@/components/chart/utils/patternOverlayUtils';
import {
    isDetectedAndVisible,
    removeHidden,
    removeSeries,
} from '@/components/chart/utils/patternOverlayUtils';

interface UsePatternOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    bars: Bar[];
    patterns: PatternResult[];
}

interface UsePatternOverlayReturn {
    visiblePatterns: Set<string>;
    togglePattern: (patternName: string) => void;
}

type VisiblePatternsAction =
    | { type: 'sync'; detected: Set<string>; allDetected: Set<string> }
    | { type: 'toggle'; patternName: string };

const visiblePatternsReducer = (
    state: Set<string>,
    action: VisiblePatternsAction
): Set<string> => {
    if (action.type === 'sync') {
        // Preserve user toggle state:
        // - Keep visible patterns that are still detected.
        // - Add patterns newly detected (not previously tracked via allDetected).
        // - Drop patterns no longer detected.
        const kept = [...action.detected].filter(
            name => !action.allDetected.has(name) || state.has(name)
        );
        // 내용이 동일하면 같은 참조 반환 → 불필요한 리렌더 방지
        if (kept.length === state.size && kept.every(n => state.has(n))) {
            return state;
        }
        return new Set(kept);
    }
    const next = new Set(state);
    if (next.has(action.patternName)) {
        next.delete(action.patternName);
    } else {
        next.add(action.patternName);
    }
    return next;
};

/**
 * PatternResult 배열을 받아 detected === true이고 renderConfig.show === true인 패턴을 차트에 렌더링한다.
 * renderConfig.type에 따라 line / marker / region 타입을 구분하여 처리한다.
 * - line: keyPrices의 각 값을 수평선으로 표시한다 (복수 keyPrices 지원).
 *   첫 번째 수평선은 renderConfig.label을 타이틀로 사용하고,
 *   이후 수평선은 각 keyPrice의 label을 타이틀로 사용한다.
 * - marker: 캔들스틱 시리즈 위에 마커 플러그인으로 표시한다.
 * - region: LineSeries 두 개로 keyPrices[0]~keyPrices[1] 사이의 구간 상단/하단 경계를 표시한다.
 */
export function usePatternOverlay({
    chartRef,
    seriesRef,
    bars,
    patterns,
}: UsePatternOverlayParams): UsePatternOverlayReturn {
    const [visiblePatterns, dispatch] = useReducer(
        visiblePatternsReducer,
        undefined,
        () => new Set<string>()
    );
    const prevChartRef = useRef<IChartApi | null>(null);
    // 초기 detected 집합으로 초기화하여 첫 sync 시 auto-show 방지
    const prevDetectedRef = useRef<Set<string>>(
        new Set(patterns.filter(isDetectedAndVisible).map(p => p.patternName))
    );
    const lineSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(
        new Map()
    );
    const regionSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(
        new Map()
    );
    const patternLineSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(
        new Map()
    );
    const markerPluginMapRef = useRef<
        Map<string, ISeriesMarkersPluginApi<UTCTimestamp>>
    >(new Map());

    const detectedPatterns = useMemo<VisiblePatternResult[]>(
        () => patterns.filter(isDetectedAndVisible),
        [patterns]
    );

    const togglePattern = useCallback((patternName: string) => {
        dispatch({ type: 'toggle', patternName });
    }, []);

    useEffect(() => {
        const detected = new Set(detectedPatterns.map(p => p.patternName));
        dispatch({
            type: 'sync',
            detected,
            allDetected: prevDetectedRef.current,
        });
        prevDetectedRef.current = detected;
    }, [detectedPatterns]);

    // 시리즈 lifecycle 관리 (생성/제거)
    // chartRef는 RefObject로 동일 참조를 유지하므로 dependency에 포함해도 교체를 감지하지 않는다.
    // chart 인스턴스 교체는 prevChartRef 비교로 감지한다.
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            // chart 인스턴스 교체 시 ref만 초기화.
            // 이전 chart는 이미 소멸되어 plugin.detach() 호출 시 에러가 발생할 수 있으므로
            // detach 없이 Map만 교체한다.
            lineSeriesMapRef.current = new Map();
            regionSeriesMapRef.current = new Map();
            patternLineSeriesMapRef.current = new Map();
            markerPluginMapRef.current = new Map();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        removeHidden(lineSeriesMapRef.current, visiblePatterns, seriesList =>
            removeSeries(chart, seriesList)
        );
        removeHidden(regionSeriesMapRef.current, visiblePatterns, seriesList =>
            removeSeries(chart, seriesList)
        );
        removeHidden(
            patternLineSeriesMapRef.current,
            visiblePatterns,
            seriesList => removeSeries(chart, seriesList)
        );
        removeHidden(markerPluginMapRef.current, visiblePatterns, plugin => {
            plugin.detach();
        });

        // 새로 표시해야 하는 패턴 시리즈 추가
        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;

            const config = pattern.renderConfig;

            if (config.type === 'line') {
                if (lineSeriesMapRef.current.has(pattern.patternName)) continue;

                const keyPrices = pattern.keyPrices ?? [];
                if (keyPrices.length === 0) continue;

                const seriesList: ISeriesApi<'Line'>[] = keyPrices.map(
                    (kp, i: number) =>
                        chart.addSeries(LineSeries, {
                            color: config.color,
                            ...BASE_PATTERN_SERIES_OPTIONS,
                            title:
                                i === LABEL_SERIES_INDEX
                                    ? config.label
                                    : kp.label,
                        })
                );
                lineSeriesMapRef.current.set(pattern.patternName, seriesList);
            } else if (config.type === 'marker') {
                if (markerPluginMapRef.current.has(pattern.patternName))
                    continue;
                if (!seriesRef.current) continue;
                // marker 표시는 감지된 keyPrice가 최소 1개 있어야 유효로 간주한다.
                // keyPrices가 빈 배열이면 데이터 동기화 이펙트에서 setMarkers 호출을 건너뛰므로
                // 플러그인만 생성되고 마커는 렌더링되지 않는 빈 플러그인이 된다.
                // 라이프사이클 일관성을 위해 이 단계에서도 동일한 조건으로 플러그인 생성을 건너뛴다.
                const keyPrices = pattern.keyPrices ?? [];
                if (keyPrices.length === 0) continue;
                const plugin = createSeriesMarkers(seriesRef.current, []);
                markerPluginMapRef.current.set(pattern.patternName, plugin);
            } else if (config.type === 'region') {
                if (regionSeriesMapRef.current.has(pattern.patternName))
                    continue;
                const keyPrices = pattern.keyPrices ?? [];
                if (keyPrices.length < REGION_KEY_PRICE_MIN_LENGTH) continue;
                // region은 두 수평선(상단/하단)으로 구간을 표시한다.
                // AreaSeries의 value는 단일 값이므로 두 경계를 표현할 수 없다.
                // 대신 LineSeries 두 개를 사용하여 상단과 하단 경계를 각각 렌더링한다.
                const upperSeries = chart.addSeries(LineSeries, {
                    color: config.color,
                    ...BASE_PATTERN_SERIES_OPTIONS,
                    title: config.label,
                });
                const lowerSeries = chart.addSeries(LineSeries, {
                    color: config.color,
                    ...BASE_PATTERN_SERIES_OPTIONS,
                    title: '',
                });
                regionSeriesMapRef.current.set(pattern.patternName, [
                    upperSeries,
                    lowerSeries,
                ]);
            }

            // 패턴 대각선 추세선 (patternLines)
            if (
                !patternLineSeriesMapRef.current.has(pattern.patternName) &&
                pattern.patternLines &&
                pattern.patternLines.length > 0
            ) {
                const seriesList: ISeriesApi<'Line'>[] =
                    pattern.patternLines.map((pl: PatternLine) =>
                        chart.addSeries(LineSeries, {
                            color: config.color,
                            ...BASE_PATTERN_SERIES_OPTIONS,
                            title: pl.label,
                        })
                    );
                patternLineSeriesMapRef.current.set(
                    pattern.patternName,
                    seriesList
                );
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

            if (config.type === 'line') {
                const seriesList = lineSeriesMapRef.current.get(
                    pattern.patternName
                );
                if (!seriesList) continue;

                const keyPrices = pattern.keyPrices ?? [];
                for (const [i, series] of seriesList.entries()) {
                    const keyPrice = keyPrices[i];
                    if (keyPrice === undefined) continue;
                    const lineData = bars.map(bar => ({
                        time: bar.time as UTCTimestamp,
                        value: keyPrice.price,
                    }));
                    series.setData(lineData);
                }
            } else if (config.type === 'marker') {
                const plugin = markerPluginMapRef.current.get(
                    pattern.patternName
                );
                if (!plugin) continue;
                const { timeRange, keyPrices = [] } = pattern;
                if (!timeRange || keyPrices.length === 0) continue;
                plugin.setMarkers([
                    {
                        time: timeRange.start as UTCTimestamp,
                        position: MARKER_POSITION,
                        color: config.color,
                        shape: MARKER_SHAPE,
                        text: config.label,
                    },
                ]);
            } else if (config.type === 'region') {
                const seriesList = regionSeriesMapRef.current.get(
                    pattern.patternName
                );
                if (!seriesList) continue;
                const { timeRange, keyPrices = [] } = pattern;
                if (
                    !timeRange ||
                    keyPrices.length < REGION_KEY_PRICE_MIN_LENGTH
                )
                    continue;
                const upper = Math.max(
                    keyPrices[REGION_LOWER_PRICE_INDEX].price,
                    keyPrices[REGION_UPPER_PRICE_INDEX].price
                );
                const lower = Math.min(
                    keyPrices[REGION_LOWER_PRICE_INDEX].price,
                    keyPrices[REGION_UPPER_PRICE_INDEX].price
                );
                const barsInRange = bars.filter(
                    bar =>
                        timeRange.start <= bar.time && bar.time <= timeRange.end
                );
                if (barsInRange.length === 0) continue;
                const [upperSeries, lowerSeries] = seriesList;
                upperSeries.setData(
                    barsInRange.map(bar => ({
                        time: bar.time as UTCTimestamp,
                        value: upper,
                    }))
                );
                lowerSeries.setData(
                    barsInRange.map(bar => ({
                        time: bar.time as UTCTimestamp,
                        value: lower,
                    }))
                );
            }

            // 패턴 대각선 추세선 데이터 동기화
            const patternLineSeriesList = patternLineSeriesMapRef.current.get(
                pattern.patternName
            );
            if (patternLineSeriesList && pattern.patternLines) {
                const lastBar = bars[bars.length - 1];
                const interval =
                    bars.length >= 2
                        ? bars[bars.length - 1].time -
                          bars[bars.length - 2].time
                        : 86400;
                const extendedTarget = lastBar.time + interval * 20;
                for (const [i, series] of patternLineSeriesList.entries()) {
                    const pl = pattern.patternLines[i];
                    if (!pl) continue;

                    const basePoints = [
                        {
                            time: pl.start.time as UTCTimestamp,
                            value: pl.start.price,
                        },
                        {
                            time: pl.end.time as UTCTimestamp,
                            value: pl.end.price,
                        },
                    ].sort((a, b) => a.time - b.time);

                    const timeDelta = pl.end.time - pl.start.time;
                    const lastPoint = basePoints[basePoints.length - 1];
                    const allPoints =
                        timeDelta !== 0 && extendedTarget > lastPoint.time
                            ? [
                                  ...basePoints,
                                  {
                                      time: extendedTarget as UTCTimestamp,
                                      value:
                                          pl.start.price +
                                          ((pl.end.price - pl.start.price) /
                                              timeDelta) *
                                              (extendedTarget - pl.start.time),
                                  },
                              ]
                            : basePoints;

                    const uniqueData = allPoints.filter(
                        (p, idx, arr) => idx === 0 || p.time > arr[idx - 1].time
                    );

                    if (uniqueData.length >= 2) {
                        series.setData(uniqueData);
                    }
                }
            }
        }
    }, [bars, detectedPatterns, visiblePatterns]);

    return { visiblePatterns, togglePattern };
}
