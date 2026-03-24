import { useCallback, useEffect, useRef, useState } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { getPeriodColor } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';

interface UseMAOverlayParams {
    chart: IChartApi | null;
    bars: Bar[];
    indicators: IndicatorResult;
    defaultPeriods?: number[];
}

interface UseMAOverlayReturn {
    visiblePeriods: number[];
    togglePeriod: (period: number) => void;
}

export function useMAOverlay({
    chart,
    bars,
    indicators,
    defaultPeriods = [],
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

    // 시리즈 생성/제거 관리
    useEffect(() => {
        // chart 인스턴스가 바뀌면 이전 시리즈 refs 초기화
        // 이전 chart 소멸은 부모가 담당하므로 removeSeries 호출 불필요
        if (prevChartRef.current !== chart) {
            seriesRef.current = {};
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
        const nextSeries: Record<number, ISeriesApi<'Line'>> = {};
        visiblePeriods.forEach(period => {
            nextSeries[period] =
                seriesRef.current[period] ??
                chart.addSeries(LineSeries, {
                    color: getPeriodColor(period),
                    lineStyle: LineStyle.Solid,
                    lineWidth: 1,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
        });
        seriesRef.current = nextSeries;
    }, [chart, visiblePeriods]);

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
