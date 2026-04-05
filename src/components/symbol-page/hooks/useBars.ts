'use client';

import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { Bar, BarsData, IndicatorResult, Timeframe } from '@/domain/types';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { QUERY_KEYS } from '@/lib/queryConfig';

interface UseBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    initialBars: Bar[];
    initialIndicators: IndicatorResult;
}

interface UseBarsResult {
    bars: Bar[];
    indicators: IndicatorResult;
}

export function useBars({
    symbol,
    timeframe,
    initialBars,
    initialIndicators,
}: UseBarsOptions): UseBarsResult {
    const [mountedAt] = useState(() => Date.now());

    const isDefaultTimeframe = timeframe === DEFAULT_TIMEFRAME;
    const { data } = useSuspenseQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        queryFn: () => getBarsAction(symbol, timeframe),
        initialData: isDefaultTimeframe
            ? { bars: initialBars, indicators: initialIndicators }
            : undefined,
        initialDataUpdatedAt: isDefaultTimeframe ? mountedAt : undefined,
    });

    const { bars, indicators } = data;

    return {
        bars,
        indicators,
    };
}
