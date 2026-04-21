'use client';

import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
            try {
                chart.unsubscribeCrosshairMove(handler);
            } catch {
                // 부모 cleanup이 먼저 실행되어 chart가 이미 dispose된 경우 무시
            }
        };
    }, [chartRef]);

    return legendItems;
}
