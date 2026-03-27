'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Bar, BarsData, IndicatorResult, Timeframe } from '@/domain/types';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
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
    // State
    // 컴포넌트 마운트 시각을 한 번만 캡처하여 initialDataUpdatedAt에 사용한다.
    // useQuery 옵션 내에서 Date.now()를 직접 호출하면 매 렌더마다 다른 값을 반환하여
    // useQuery options의 referential equality를 깨뜨리므로
    // useState 지연 초기화를 통해 렌더 외부에서 값을 얻는다.
    const [mountedAt] = useState<number>(() => Date.now());

    // Query hooks
    const { data } = useSuspenseQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        queryFn: ({ signal }) =>
            fetchBarsWithIndicators(symbol, timeframe, signal),
        initialData:
            timeframe === DEFAULT_TIMEFRAME
                ? { bars: initialBars, indicators: initialIndicators }
                : undefined,
        initialDataUpdatedAt:
            timeframe === DEFAULT_TIMEFRAME ? mountedAt : undefined,
    });

    // Derived variables
    const bars = data.bars;
    const indicators = data.indicators;

    return {
        bars,
        indicators,
    };
}
