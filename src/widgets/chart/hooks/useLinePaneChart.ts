'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import type { LinePaneSpec } from '../model/linePaneSpecs';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseLinePaneChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    /** `LINE_PANE_SPECS`의 항목 — 모듈 상수라 참조가 안정적이다. */
    spec: LinePaneSpec;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

/** 단일 선 + 점선 기준선 보조지표를 자기 패인에 그린다(`LINE_PANE_SPECS`). */
export function useLinePaneChart({
    chartRef,
    bars,
    indicators,
    spec,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseLinePaneChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // 이전 chart는 부모가 소멸시키므로 removeSeries 없이 ref만 초기화하면 충분.
    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
        }
    });

    // 데이터 세팅은 아래 effect에서 단독 처리하므로 이 effect는 lifecycle(생성·제거)만 담당.
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

        if (prevPaneIndexRef.current !== paneIndex && seriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!seriesRef.current) {
            const series = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS[spec.lineColor],
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
            spec.referenceLines.forEach(({ price, color }) => {
                series.createPriceLine({
                    price,
                    color: CHART_COLORS[color],
                    lineWidth,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: '',
                });
            });
            seriesRef.current = series;
        }
        seriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex, spec]);

    useEffect(() => {
        if (!isVisible || !seriesRef.current) return;

        const values = spec.values(indicators);
        if (!values.length) return;

        seriesRef.current.setData(buildSeriesDataFromValues(bars, values));
    }, [indicators, bars, isVisible, paneIndex, spec]);
}
