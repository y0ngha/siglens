'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { AreaSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

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
    lineWidth = DEFAULT_LINE_WIDTH, // TODO: 사용자 설정으로 연결
}: UseBollingerOverlayParams): UseBollingerOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const upperSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const middleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lowerSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        upperSeriesRef.current = null;
        middleSeriesRef.current = null;
        lowerSeriesRef.current = null;
    });

    // isVisible false 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
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
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태
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
        upperSeriesRef.current.applyOptions({ lineWidth });

        if (!middleSeriesRef.current) {
            middleSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.bollingerMiddle,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        middleSeriesRef.current.applyOptions({ lineWidth });

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
        lowerSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { bollinger } = indicators;
        if (!bollinger.length) return;

        if (upperSeriesRef.current) {
            upperSeriesRef.current.setData(
                buildSeriesData(bars, bollinger, 'upper')
            );
        }
        if (middleSeriesRef.current) {
            middleSeriesRef.current.setData(
                buildSeriesData(bars, bollinger, 'middle')
            );
        }
        if (lowerSeriesRef.current) {
            lowerSeriesRef.current.setData(
                buildSeriesData(bars, bollinger, 'lower')
            );
        }
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
