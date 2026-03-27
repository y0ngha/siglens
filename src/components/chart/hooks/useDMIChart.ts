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
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import {
    DEFAULT_LINE_WIDTH,
    DMI_PANE_INDEX,
} from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/hooks/seriesDataUtils';

interface UseDMIChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseDMIChartReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useDMIChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseDMIChartParams): UseDMIChartReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const diPlusSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const diMinusSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const adxSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        diPlusSeriesRef.current = null;
        diMinusSeriesRef.current = null;
        adxSeriesRef.current = null;
    });

    // isVisible false 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (diPlusSeriesRef.current) {
            chart.removeSeries(diPlusSeriesRef.current);
            diPlusSeriesRef.current = null;
        }
        if (diMinusSeriesRef.current) {
            chart.removeSeries(diMinusSeriesRef.current);
            diMinusSeriesRef.current = null;
        }
        if (adxSeriesRef.current) {
            chart.removeSeries(adxSeriesRef.current);
            adxSeriesRef.current = null;
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

        if (!diPlusSeriesRef.current) {
            diPlusSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.dmiPlus,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                DMI_PANE_INDEX
            );
        }

        if (!diMinusSeriesRef.current) {
            diMinusSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.dmiMinus,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                DMI_PANE_INDEX
            );
        }

        if (!adxSeriesRef.current) {
            adxSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.dmiAdx,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                DMI_PANE_INDEX
            );
        }

        diPlusSeriesRef.current.applyOptions({ lineWidth });
        diMinusSeriesRef.current.applyOptions({ lineWidth });
        adxSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { dmi } = indicators;
        if (!dmi.length) return;

        if (
            !diPlusSeriesRef.current ||
            !diMinusSeriesRef.current ||
            !adxSeriesRef.current
        )
            return;

        const diPlusData = buildSeriesData(bars, dmi, 'diPlus');
        const diMinusData = buildSeriesData(bars, dmi, 'diMinus');
        const adxData = buildSeriesData(bars, dmi, 'adx');

        diPlusSeriesRef.current.setData(diPlusData);
        diMinusSeriesRef.current.setData(diMinusData);
        adxSeriesRef.current.setData(adxData);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
