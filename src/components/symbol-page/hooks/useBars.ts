'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type {
    Bar,
    BarsData,
    IndicatorResult,
    Timeframe,
} from '@y0ngha/siglens-core';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';

interface UseBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    fmpSymbol?: string;
}

interface UseBarsResult {
    bars: Bar[];
    indicators: IndicatorResult;
}

export function useBars({
    symbol,
    timeframe,
    fmpSymbol,
}: UseBarsOptions): UseBarsResult {
    const { data } = useSuspenseQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        queryFn: () => getBarsAction(symbol, timeframe, fmpSymbol),
        // OHLCV bars update on the order of seconds during market hours; a
        // short staleTime keeps repaints fresh without thrashing the API.
        staleTime: BARS_STALE_TIME_MS,
    });

    return { bars: data.bars, indicators: data.indicators };
}
