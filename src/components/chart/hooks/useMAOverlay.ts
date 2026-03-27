'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { getPeriodColor } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

interface UseMAOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    defaultPeriods?: number[];
    lineWidth?: LineWidth;
}

interface UseMAOverlayReturn {
    visiblePeriods: number[];
    togglePeriod: (period: number) => void;
}

export function useMAOverlay({
    chartRef,
    bars,
    indicators,
    defaultPeriods = [],
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseMAOverlayParams): UseMAOverlayReturn {
    const [visiblePeriods, setVisiblePeriods] =
        useState<number[]>(defaultPeriods);
    const prevChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<Record<number, ISeriesApi<'Line'>>>({});

    const togglePeriod = useCallback((period: number) => {
        setVisiblePeriods(prev =>
            prev.includes(period)
                ? prev.filter(p => p !== period)
                : [...prev, period]
        );
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = {};
    });

    // 시리즈 생성/제거 관리
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        // visiblePeriods에서 제거된 기간의 시리즈 삭제
        const periodsToRemove = Object.keys(seriesRef.current)
            .map(Number)
            .filter(period => !visiblePeriods.includes(period));

        periodsToRemove.forEach(period => {
            const series = seriesRef.current[period];
            if (series) chart.removeSeries(series);
        });

        // 기존 시리즈 유지 + 새 기간 시리즈 추가로 refs 재구성
        // applyOptions로 lineWidth 변경을 기존 시리즈에도 반영
        const nextSeries: Record<number, ISeriesApi<'Line'>> = {};
        visiblePeriods.forEach(period => {
            const series =
                seriesRef.current[period] ??
                chart.addSeries(LineSeries, {
                    color: getPeriodColor(period),
                    lineStyle: LineStyle.Solid,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
            series.applyOptions({ lineWidth });
            nextSeries[period] = series;
        });
        seriesRef.current = nextSeries;
    }, [chartRef, visiblePeriods, lineWidth]);

    // 데이터 동기화
    // bars와 maData의 정합성 보장을 위해 Math.min으로 길이를 맞춰 매핑
    useEffect(() => {
        visiblePeriods.forEach(period => {
            const series = seriesRef.current[period];
            const maData = indicators.ma[period];
            if (!series || !maData) return;

            const count = Math.min(bars.length, maData.length);
            series.setData(
                bars.slice(0, count).map((bar, i) => {
                    const value = maData[i];
                    return value !== null && value !== undefined
                        ? { time: bar.time as UTCTimestamp, value }
                        : { time: bar.time as UTCTimestamp };
                })
            );
        });
    }, [indicators, bars, visiblePeriods]);

    return { visiblePeriods, togglePeriod };
}
