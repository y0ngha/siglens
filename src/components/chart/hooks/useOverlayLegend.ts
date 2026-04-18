'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@/domain/types';
import type { OverlayLegendItem } from '@/components/chart/types';
import {
    findBarIndex,
    type OverlayLabelConfig,
    resolveBarIndex,
    resolveOverlayValues,
} from '@/components/chart/utils/overlayLabelUtils';

interface UseOverlayLegendParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    labelConfigs: OverlayLabelConfig[];
}

export function useOverlayLegend({
    chartRef,
    bars,
    indicators,
    labelConfigs,
}: UseOverlayLegendParams): OverlayLegendItem[] {
    const [crosshairIndex, setCrosshairIndex] = useState<number | null>(null);

    const barsRef = useRef<Bar[]>(bars);

    const barIndex = resolveBarIndex(bars, crosshairIndex);

    const legendItems = useMemo(
        () => resolveOverlayValues(labelConfigs, indicators, barIndex),
        [labelConfigs, indicators, barIndex]
    );

    useEffect(() => {
        barsRef.current = bars;
    }, [bars]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const handler = (param: { time?: unknown }): void => {
            if (typeof param.time === 'number') {
                const idx = findBarIndex(barsRef.current, param.time);
                setCrosshairIndex(prev => (prev === idx ? prev : idx));
            } else {
                setCrosshairIndex(prev => (prev === null ? prev : null));
            }
        };

        chart.subscribeCrosshairMove(handler);

        return () => {
            // chart 생성 effect cleanup이 먼저 실행되어 chart.remove()로 dispose된 후
            // 이 cleanup이 실행될 수 있으므로, ref를 통해 생존 여부를 확인한다.
            // chart.remove()는 모든 구독을 정리하므로 null이면 별도 해제 불필요.
            chartRef.current?.unsubscribeCrosshairMove(handler);
        };
    }, [chartRef]);

    return legendItems;
}
