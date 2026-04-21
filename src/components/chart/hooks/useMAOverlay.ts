'use client';

import type { RefObject } from 'react';
import type { IChartApi, LineWidth } from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@/domain/types';
import {
    type IndicatorDataAccessor,
    useMovingAverageOverlay,
} from './useMovingAverageOverlay';

const getMaData: IndicatorDataAccessor = (indicators, period) =>
    indicators.ma[period];

interface UseMAOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    defaultPeriods?: number[];
    lineWidth?: LineWidth;
}

interface UseMAOverlayReturn {
    visiblePeriods: number[];
    togglePeriod: (period: number) => void;
}

export function useMAOverlay({
    chartRef,
    bars,
    indicators,
    defaultPeriods,
    lineWidth,
}: UseMAOverlayParams): UseMAOverlayReturn {
    return useMovingAverageOverlay({
        chartRef,
        bars,
        indicators,
        defaultPeriods,
        lineWidth,
        lineStyle: LineStyle.Solid,
        getIndicatorData: getMaData,
    });
}
