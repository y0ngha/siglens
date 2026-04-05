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
    // 컴포넌트 마운트 시각을 한 번만 캡처하여 initialDataUpdatedAt에 사용한다.
    // useQuery 옵션 내에서 Date.now()를 직접 호출하면 매 렌더마다 다른 값을 반환하여
    // useQuery options의 referential equality를 깨뜨리므로
    // useState 지연 초기화를 통해 렌더 외부에서 값을 얻는다.
    const [mountedAt] = useState(() => Date.now());

    const isDefaultTimeframe = timeframe === DEFAULT_TIMEFRAME;
    const { data } = useSuspenseQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        // Server Action은 AbortSignal을 지원하지 않으므로 queryFn에 signal을 전달하지 않는다.
        // 빠른 타임프레임 전환 시 in-flight 요청을 취소할 수 없다는 trade-off가 있다.
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
