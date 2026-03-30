'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { Bar, PatternResult } from '@/domain/types';

interface UsePatternOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    patterns: PatternResult[];
}

interface UsePatternOverlayReturn {
    visiblePatterns: Set<string>;
    togglePattern: (patternName: string) => void;
}

/**
 * PatternResult 배열을 받아 detected === true인 패턴을 차트에 렌더링한다.
 * renderConfig.type에 따라 line / marker / region 타입을 구분하여 처리한다.
 * 현재 line 타입은 keyPrices의 첫 번째 값을 수평선으로 표시한다.
 */
export function usePatternOverlay({
    chartRef,
    bars,
    patterns,
}: UsePatternOverlayParams): UsePatternOverlayReturn {
    const [visiblePatterns, setVisiblePatterns] = useState<Set<string>>(
        () => new Set(patterns.filter(p => p.detected).map(p => p.patternName))
    );
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    const togglePattern = useCallback((patternName: string) => {
        setVisiblePatterns(prev => {
            const next = new Set(prev);
            if (next.has(patternName)) {
                next.delete(patternName);
            } else {
                next.add(patternName);
            }
            return next;
        });
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화
    const clearSeriesRefs = useEffectEvent(() => {
        seriesMapRef.current = new Map();
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        const detectedPatterns = patterns.filter(
            p => p.detected && p.renderConfig
        );

        // visiblePatterns에서 제거된 시리즈 삭제
        for (const [name, series] of seriesMapRef.current.entries()) {
            if (!visiblePatterns.has(name)) {
                chart.removeSeries(series);
                seriesMapRef.current.delete(name);
            }
        }

        // 새로 표시해야 하는 패턴 시리즈 추가
        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;
            if (seriesMapRef.current.has(pattern.patternName)) continue;

            const config = pattern.renderConfig;
            if (!config || config.type !== 'line') continue;

            const series = chart.addSeries(LineSeries, {
                color: config.color,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                title: config.label,
            });
            seriesMapRef.current.set(pattern.patternName, series);
        }
    }, [chartRef, visiblePatterns, patterns]);

    // 데이터 동기화
    useEffect(() => {
        if (bars.length === 0) return;

        const detectedPatterns = patterns.filter(
            p => p.detected && p.renderConfig
        );

        for (const pattern of detectedPatterns) {
            if (!visiblePatterns.has(pattern.patternName)) continue;

            const series = seriesMapRef.current.get(pattern.patternName);
            if (!series) continue;

            const config = pattern.renderConfig;
            if (!config || config.type !== 'line') continue;

            const keyPrice = pattern.keyPrices?.[0];
            if (keyPrice === undefined) continue;

            const lineData = bars.map(bar => ({
                time: bar.time as UTCTimestamp,
                value: keyPrice,
            }));
            series.setData(lineData);
        }
    }, [bars, patterns, visiblePatterns]);

    return { visiblePatterns, togglePattern };
}
