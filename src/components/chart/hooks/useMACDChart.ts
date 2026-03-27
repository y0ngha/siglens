'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { HistogramSeries, LineSeries } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import {
    DEFAULT_LINE_WIDTH,
    MACD_PANE_INDEX,
} from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

interface UseMACDChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseMACDChartReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useMACDChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseMACDChartParams): UseMACDChartReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const signalLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const histogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        macdLineSeriesRef.current = null;
        signalLineSeriesRef.current = null;
        histogramSeriesRef.current = null;
    });

    // isVisible false 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (macdLineSeriesRef.current) {
            chart.removeSeries(macdLineSeriesRef.current);
            macdLineSeriesRef.current = null;
        }
        if (signalLineSeriesRef.current) {
            chart.removeSeries(signalLineSeriesRef.current);
            signalLineSeriesRef.current = null;
        }
        if (histogramSeriesRef.current) {
            chart.removeSeries(histogramSeriesRef.current);
            histogramSeriesRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (!isVisible) {
            removeAllSeries(chart);
            return;
        }

        if (!macdLineSeriesRef.current) {
            macdLineSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.macdLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                MACD_PANE_INDEX
            );
        }

        if (!signalLineSeriesRef.current) {
            signalLineSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.macdSignal,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                MACD_PANE_INDEX
            );
        }

        if (!histogramSeriesRef.current) {
            histogramSeriesRef.current = chart.addSeries(
                HistogramSeries,
                {
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                MACD_PANE_INDEX
            );
        }

        macdLineSeriesRef.current.applyOptions({ lineWidth });
        signalLineSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { macd } = indicators;
        if (!macd.length) return;

        if (
            !macdLineSeriesRef.current ||
            !signalLineSeriesRef.current ||
            !histogramSeriesRef.current
        )
            return;

        const count = Math.min(bars.length, macd.length);

        const macdLineData = buildSeriesData(bars, macd, 'macd');
        const signalLineData = buildSeriesData(bars, macd, 'signal');

        const histogramData = bars.slice(0, count).map((bar, i) => {
            const value = macd[i]?.histogram;
            if (value === null || value === undefined) {
                return { time: bar.time as UTCTimestamp };
            }
            return {
                time: bar.time as UTCTimestamp,
                value,
                color:
                    value >= 0
                        ? CHART_COLORS.macdHistogramBullish
                        : CHART_COLORS.macdHistogramBearish,
            };
        });

        macdLineSeriesRef.current.setData(macdLineData);
        signalLineSeriesRef.current.setData(signalLineData);
        histogramSeriesRef.current.setData(histogramData);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
