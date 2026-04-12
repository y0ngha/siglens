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
import type {
    IChartApi,
    ISeriesApi,
    LineStyle,
    LineWidth,
} from 'lightweight-charts';
import { getPeriodColor } from '@/lib/chartColors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesDataFromValues } from '@/components/chart/utils/seriesDataUtils';

export type IndicatorDataAccessor = (
    indicators: IndicatorResult,
    period: number
) => (number | null)[] | undefined;

interface UseMovingAverageOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    defaultPeriods?: number[];
    lineWidth?: LineWidth;
    lineStyle: LineStyle;
    getIndicatorData: IndicatorDataAccessor;
}

interface UseMovingAverageOverlayReturn {
    visiblePeriods: number[];
    togglePeriod: (period: number) => void;
}

export function useMovingAverageOverlay({
    chartRef,
    bars,
    indicators,
    defaultPeriods = [],
    lineWidth = DEFAULT_LINE_WIDTH,
    lineStyle,
    getIndicatorData,
}: UseMovingAverageOverlayParams): UseMovingAverageOverlayReturn {
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
    const stableGetIndicatorData = useEffectEvent(getIndicatorData);

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

        for (const period of periodsToRemove) {
            const series = seriesRef.current[period];
            if (series) chart.removeSeries(series);
        }

        // 기존 시리즈 유지 + 새 기간 시리즈 추가로 refs 재구성
        // applyOptions로 lineWidth 변경을 기존 시리즈에도 반영
        seriesRef.current = Object.fromEntries(
            visiblePeriods.map(period => {
                const series =
                    seriesRef.current[period] ??
                    chart.addSeries(LineSeries, {
                        color: getPeriodColor(period),
                        lineStyle,
                        lineWidth,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                series.applyOptions({ lineWidth });
                return [period, series] as const;
            })
        ) as Record<number, ISeriesApi<'Line'>>;
    }, [chartRef, visiblePeriods, lineWidth, lineStyle]);

    // 데이터 동기화
    useEffect(() => {
        for (const period of visiblePeriods) {
            const series = seriesRef.current[period];
            const data = stableGetIndicatorData(indicators, period);
            if (!series || !data) continue;

            series.setData(buildSeriesDataFromValues(bars, data));
        }
    }, [indicators, bars, visiblePeriods]);

    return { visiblePeriods, togglePeriod };
}
