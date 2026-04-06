'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { Bar, BarsData, IndicatorResult, Timeframe } from '@/domain/types';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { QUERY_KEYS } from '@/lib/queryConfig';

interface UseBarsOptions {
    symbol: string;
    timeframe: Timeframe;
}

interface UseBarsResult {
    bars: Bar[];
    indicators: IndicatorResult;
}

export function useBars({ symbol, timeframe }: UseBarsOptions): UseBarsResult {
    const { data } = useSuspenseQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        queryFn: () => getBarsAction(symbol, timeframe),
    });

    return { bars: data.bars, indicators: data.indicators };
}
