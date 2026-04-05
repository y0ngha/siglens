'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { Bar, BarsData, IndicatorResult, Timeframe } from '@/domain/types';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import {
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
    QUERY_GC_TIME_MS,
} from '@/lib/queryConfig';

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
        // Server Action은 AbortSignal을 지원하지 않으므로 queryFn에 signal을 전달하지 않는다.
        // 빠른 타임프레임 전환 시 in-flight 요청을 취소할 수 없다는 trade-off가 있다.
        queryFn: () => getBarsAction(symbol, timeframe),
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
    });

    return { bars: data.bars, indicators: data.indicators };
}
