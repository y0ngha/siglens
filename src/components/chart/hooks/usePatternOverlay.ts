'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useMemo,
    useReducer,
    useRef,
} from 'react';
import type { RefObject } from 'react';
import { LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { Bar, PatternResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

interface UsePatternOverlayParams {
    chartRef: RefObject<IChartApi | null>;
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

/**
 * PatternResult 배열을 받아 detected === true인 패턴을 차트에 렌더링한다.
 * renderConfig.type에 따라 line / marker / region 타입을 구분하여 처리한다.
 * line 타입은 keyPrices의 각 값을 개별 수평선으로 표시한다.
 * 첫 번째 수평선은 renderConfig.label을 타이틀로 사용하고,
 * 이후 수평선은 빈 타이틀로 표시된다.
 */
export function usePatternOverlay({
    chartRef,
    bars,
    patterns,
}: UsePatternOverlayParams): UsePatternOverlayReturn {
    const [visiblePatterns, dispatch] = useReducer(
        visiblePatternsReducer,
        patterns,
        initial =>
            new Set(
                initial
                    .filter(p => p.detected && p.renderConfig)
                    .map(p => p.patternName)
            )
    );
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(new Map());

    const detectedPatterns = useMemo(
        () => patterns.filter(p => p.detected && p.renderConfig),
        [patterns]
    );

    const togglePattern = useCallback((patternName: string) => {
        dispatch({ type: 'toggle', patternName });
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화
    const clearSeriesRefs = useEffectEvent(() => {
        seriesMapRef.current = new Map();
    });

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
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        // visiblePatterns에서 제거된 시리즈 삭제
        for (const [name, seriesList] of seriesMapRef.current.entries()) {
            if (!visiblePatterns.has(name)) {
                for (const series of seriesList) {
                    chart.removeSeries(series);
                }
                seriesMapRef.current.delete(name);
            }
        }

        // 새로 표시해야 하는 패턴 시리즈 추가
        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;
            if (seriesMapRef.current.has(pattern.patternName)) continue;

            const config = pattern.renderConfig;
            if (!config || config.type !== 'line') continue;

            const keyPrices = pattern.keyPrices ?? [];
            if (keyPrices.length === 0) continue;

            const seriesList = keyPrices.map((kp, index) =>
                chart.addSeries(LineSeries, {
                    color: config.color,
                    lineWidth: DEFAULT_LINE_WIDTH,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    title: index === 0 ? config.label : kp.label,
                })
            );
            seriesMapRef.current.set(pattern.patternName, seriesList);
        }
        // chartRef(RefObject)는 항상 동일 참조를 유지하므로 이 dependency는
        // 실제로 chart 교체를 감지하지 않는다. chart 교체 감지는 prevChartRef 비교로 처리한다.
    }, [chartRef, visiblePatterns, detectedPatterns]);

    // 데이터 동기화
    useEffect(() => {
        if (bars.length === 0) return;

        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;

            const seriesList = seriesMapRef.current.get(pattern.patternName);
            if (!seriesList) continue;

            const config = pattern.renderConfig;
            if (!config || config.type !== 'line') continue;

            const keyPrices = pattern.keyPrices ?? [];

            seriesList.forEach((series, index) => {
                const keyPrice = keyPrices[index];
                if (keyPrice === undefined) return;

                const lineData = bars.map(bar => ({
                    time: bar.time as UTCTimestamp,
                    value: keyPrice.price,
                }));
                series.setData(lineData);
            });
        }
    }, [bars, detectedPatterns, visiblePatterns]);

    return { visiblePatterns, togglePattern };
}
