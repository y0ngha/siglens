'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { Bar, BarsData, IndicatorResult, Timeframe } from '@/domain/types';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { getBarsAction } from '@/app/actions/getBarsAction';
import { QUERY_KEYS } from '@/lib/queryConfig';

// 모듈 로드 시각을 initialDataUpdatedAt으로 사용한다.
// 렌더 함수 외부에서 호출되므로 react-hooks/purity 규칙을 위반하지 않는다.
const MODULE_LOAD_TIME = Date.now();

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
    const isDefaultTimeframe = timeframe === DEFAULT_TIMEFRAME;
    const { data } = useSuspenseQuery<BarsData, Error>({
        queryKey: QUERY_KEYS.bars(symbol, timeframe),
        queryFn: () => getBarsAction(symbol, timeframe),
        initialData: isDefaultTimeframe
            ? { bars: initialBars, indicators: initialIndicators }
            : undefined,
        initialDataUpdatedAt: isDefaultTimeframe ? MODULE_LOAD_TIME : undefined,
    });

    const { bars, indicators } = data;

    return {
        bars,
        indicators,
    };
}
