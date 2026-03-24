import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AreaSeries, LineSeries } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';

interface UseBollingerOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseBollingerOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useBollingerOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = 1, // TODO: 사용자 설정으로 연결
}: UseBollingerOverlayParams): UseBollingerOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const upperSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const middleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lowerSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // 시리즈 생성/제거 관리
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태
    useEffect(() => {
        const chart = chartRef.current;

        // chart 인스턴스가 바뀌면 이전 시리즈 refs 초기화
        // 이전 chart 소멸은 부모가 담당하므로 removeSeries 호출 불필요
        if (prevChartRef.current !== chart) {
            upperSeriesRef.current = null;
            middleSeriesRef.current = null;
            lowerSeriesRef.current = null;
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (isVisible) {
            if (!upperSeriesRef.current) {
                upperSeriesRef.current = chart.addSeries(AreaSeries, {
                    topColor: CHART_COLORS.bollingerBackground,
                    bottomColor: CHART_COLORS.bollingerBackground,
                    lineColor: CHART_COLORS.bollingerUpper,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
            }
            if (!middleSeriesRef.current) {
                middleSeriesRef.current = chart.addSeries(LineSeries, {
                    color: CHART_COLORS.bollingerMiddle,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
            }
            if (!lowerSeriesRef.current) {
                lowerSeriesRef.current = chart.addSeries(AreaSeries, {
                    topColor: CHART_COLORS.background,
                    bottomColor: CHART_COLORS.background,
                    lineColor: CHART_COLORS.bollingerLower,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
            }
        } else {
            if (upperSeriesRef.current) {
                chart.removeSeries(upperSeriesRef.current);
                upperSeriesRef.current = null;
            }
            if (middleSeriesRef.current) {
                chart.removeSeries(middleSeriesRef.current);
                middleSeriesRef.current = null;
            }
            if (lowerSeriesRef.current) {
                chart.removeSeries(lowerSeriesRef.current);
                lowerSeriesRef.current = null;
            }
        }
    }, [chartRef, isVisible, lineWidth]);

    // 데이터 동기화
    // bars와 bollinger 데이터의 정합성 보장을 위해 Math.min으로 길이를 맞춰 매핑
    useEffect(() => {
        const { bollinger } = indicators;
        if (!bollinger.length) return;

        const count = Math.min(bars.length, bollinger.length);
        const mappedBars = bars.slice(0, count);

        if (upperSeriesRef.current) {
            upperSeriesRef.current.setData(
                mappedBars.map((bar, i) => {
                    const value = bollinger[i]?.upper;
                    return value !== null && value !== undefined
                        ? { time: bar.time as UTCTimestamp, value }
                        : { time: bar.time as UTCTimestamp };
                })
            );
        }

        if (middleSeriesRef.current) {
            middleSeriesRef.current.setData(
                mappedBars.map((bar, i) => {
                    const value = bollinger[i]?.middle;
                    return value !== null && value !== undefined
                        ? { time: bar.time as UTCTimestamp, value }
                        : { time: bar.time as UTCTimestamp };
                })
            );
        }

        if (lowerSeriesRef.current) {
            lowerSeriesRef.current.setData(
                mappedBars.map((bar, i) => {
                    const value = bollinger[i]?.lower;
                    return value !== null && value !== undefined
                        ? { time: bar.time as UTCTimestamp, value }
                        : { time: bar.time as UTCTimestamp };
                })
            );
        }
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
