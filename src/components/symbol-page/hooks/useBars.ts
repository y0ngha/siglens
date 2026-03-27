'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Bar, IndicatorResult, Timeframe } from '@/domain/types';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import type { BarsData } from '@/infrastructure/market/barsApi';
import { QUERY_KEYS } from '@/lib/queryKeys';

const EMPTY_INDICATOR_RESULT: IndicatorResult = {
    macd: [],
    bollinger: [],
    dmi: [],
    rsi: [],
    vwap: [],
    ma: {},
    ema: {},
};

interface UseBarsOptions {
    symbol: string;
    initialBars: Bar[];
    initialIndicators: IndicatorResult;
}

interface UseBarsResult {
    bars: Bar[];
    indicators: IndicatorResult;
    timeframe: Timeframe;
    isLoadingBars: boolean;
    barsError: string | null;
    handleTimeframeChange: (nextTimeframe: Timeframe) => void;
}

export function useBars({
    symbol,
    initialBars,
    initialIndicators,
}: UseBarsOptions): UseBarsResult {
    const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
    const queryClient = useQueryClient();

    const { data, isPending, error } = useQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        queryFn: ({ signal }) =>
            fetchBarsWithIndicators(symbol, timeframe, signal),
        ...(timeframe === DEFAULT_TIMEFRAME
            ? {
                  initialData: {
                      bars: initialBars,
                      indicators: initialIndicators,
                  },
              }
            : {}),
    });

    const handleTimeframeChange = (nextTimeframe: Timeframe): void => {
        if (nextTimeframe === timeframe) return;
        void queryClient.cancelQueries({
            queryKey: QUERY_KEYS.bars(symbol, timeframe),
        });
        setTimeframe(nextTimeframe);
    };

    return {
        bars: data?.bars ?? [],
        indicators: data?.indicators ?? EMPTY_INDICATOR_RESULT,
        timeframe,
        isLoadingBars: isPending,
        barsError: error?.message ?? null,
        handleTimeframeChange,
    };
}
