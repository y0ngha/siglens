'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { getSymbolFearGreedAction } from '@/entities/bars/actions/getSymbolFearGreedAction';
import type { SymbolFearGreedSeries } from '@/entities/bars/lib/symbolFearGreed';
import {
    QUERY_KEYS,
    SYMBOL_FEAR_GREED_STALE_TIME_MS,
} from '@/shared/config/queryConfig';

interface UseFearGreedFromSymbolInput {
    symbol: string;
    fmpSymbol?: string;
}

/**
 * 종목 공포·탐욕 snapshot + history. 일봉 고정(spec §2)이고, 점수는 서버가 5년
 * 일봉으로 계산한 값이다(`getSymbolFearGreedAction`). 예전에는 `useBars`의 2년
 * 일봉으로 여기서 직접 계산했는데, 그러면 헤더 배지·요약(5년)과 게이지(2년)의 같은
 * 날 점수가 달라진다. 페이지가 서버 계산값으로 이 쿼리를 seed한다.
 */
export function useFearGreedFromSymbol({
    symbol,
    fmpSymbol,
}: UseFearGreedFromSymbolInput): SymbolFearGreedSeries {
    const { data } = useSuspenseQuery({
        queryKey: QUERY_KEYS.symbolFearGreed(symbol, fmpSymbol),
        queryFn: ({ queryKey: [, qSymbol, qFmpSymbol] }) =>
            getSymbolFearGreedAction(qSymbol, qFmpSymbol),
        staleTime: SYMBOL_FEAR_GREED_STALE_TIME_MS,
    });
    return data;
}
