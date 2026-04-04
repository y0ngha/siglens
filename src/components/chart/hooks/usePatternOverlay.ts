'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries, createSeriesMarkers } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    ISeriesMarkersPluginApi,
    UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, PatternResult } from '@/domain/types';
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
        return new Set(
            [...action.detected].filter(
                name => !action.allDetected.has(name) || state.has(name)
            )
        );
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
        patterns,
        initial =>
            new Set(
                initial.filter(isDetectedAndVisible).map(p => p.patternName)
            )
    );
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevDetectedRef = useRef<Set<string>>(new Set());
    const lineSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(
        new Map()
    );
    const regionSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(
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
                    (_price: number, i: number) =>
                        chart.addSeries(LineSeries, {
                            color: config.color,
                            ...BASE_PATTERN_SERIES_OPTIONS,
                            title: i === LABEL_SERIES_INDEX ? config.label : '',
                        })
                );
                lineSeriesMapRef.current.set(pattern.patternName, seriesList);
            } else if (config.type === 'marker') {
                if (markerPluginMapRef.current.has(pattern.patternName))
                    continue;
                if (!seriesRef.current) continue;
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
                    const price = keyPrices[i];
                    if (price === undefined) continue;
                    const lineData = bars.map(bar => ({
                        time: bar.time as UTCTimestamp,
                        value: price,
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
                    keyPrices[REGION_LOWER_PRICE_INDEX],
                    keyPrices[REGION_UPPER_PRICE_INDEX]
                );
                const lower = Math.min(
                    keyPrices[REGION_LOWER_PRICE_INDEX],
                    keyPrices[REGION_UPPER_PRICE_INDEX]
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
        }
    }, [bars, detectedPatterns, visiblePatterns]);

    return { visiblePatterns, togglePattern };
}
