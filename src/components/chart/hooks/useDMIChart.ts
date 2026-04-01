'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import { LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';
import { buildSeriesData } from '@/components/chart/utils/seriesDataUtils';

interface UseDMIChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useDMIChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseDMIChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const diPlusSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const diMinusSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const adxSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        diPlusSeriesRef.current = null;
        diMinusSeriesRef.current = null;
        adxSeriesRef.current = null;
    });

    // isVisible false 또는 paneIndex 변경 시 시리즈 제거 및 ref 초기화
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

        // paneIndex 변경 시 시리즈 제거 후 재생성
        if (prevPaneIndexRef.current !== paneIndex && diPlusSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!diPlusSeriesRef.current) {
            diPlusSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.dmiPlus,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
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
                paneIndex
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
                paneIndex
            );
        }

        diPlusSeriesRef.current.applyOptions({ lineWidth });
        diMinusSeriesRef.current.applyOptions({ lineWidth });
        adxSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

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
    }, [indicators, bars, isVisible, paneIndex]);
}
