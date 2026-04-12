'use client';

import type { RefObject } from 'react';
import { LineStyle } from 'lightweight-charts';
import type { IChartApi, LineWidth } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@/domain/types';
import {
    useMovingAverageOverlay,
    type IndicatorDataAccessor,
} from './useMovingAverageOverlay';

const getEmaData: IndicatorDataAccessor = (indicators, period) =>
    indicators.ema[period];

interface UseEMAOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    defaultPeriods?: number[];
    lineWidth?: LineWidth;
}

interface UseEMAOverlayReturn {
    visiblePeriods: number[];
    togglePeriod: (period: number) => void;
}

export function useEMAOverlay({
    chartRef,
    bars,
    indicators,
    defaultPeriods,
    lineWidth,
}: UseEMAOverlayParams): UseEMAOverlayReturn {
    return useMovingAverageOverlay({
        chartRef,
        bars,
        indicators,
        defaultPeriods,
        lineWidth,
        lineStyle: LineStyle.Dotted,
        getIndicatorData: getEmaData,
    });
}
