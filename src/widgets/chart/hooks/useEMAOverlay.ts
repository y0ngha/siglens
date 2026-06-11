'use client';

import type { RefObject } from 'react';
import type { IChartApi, LineWidth } from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { STORAGE_KEYS } from '../constants';
import {
    type IndicatorDataAccessor,
    useMovingAverageOverlay,
} from './useMovingAverageOverlay';

const getEmaData: IndicatorDataAccessor = (indicators, period) =>
    indicators.ema[period];

interface UseEMAOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    storageKey?: string;
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
    storageKey = STORAGE_KEYS.emaPeriods,
    defaultPeriods,
    lineWidth,
}: UseEMAOverlayParams): UseEMAOverlayReturn {
    return useMovingAverageOverlay({
        chartRef,
        bars,
        indicators,
        storageKey,
        defaultPeriods,
        lineWidth,
        lineStyle: LineStyle.Dotted,
        getIndicatorData: getEmaData,
    });
}
