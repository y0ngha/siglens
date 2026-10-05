'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getSymbolFearGreedAction } from '@/entities/bars/actions/getSymbolFearGreedAction';
import type { SymbolFearGreedSeries } from '@/entities/bars/lib/symbolFearGreed';
import {
    QUERY_KEYS,
    SYMBOL_FEAR_GREED_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useRefetchStaleOnEnable } from '@/shared/hooks/useRefetchStaleOnEnable';

interface UseFearGreedFromSymbolInput {
    symbol: string;
    fmpSymbol?: string;
    /**
     * seed가 있을 때 마운트 직후 재조회를 시작해도 되는지(기본 true). 호출부가 "사람 상호작용
     * 이후"일 때만 `true`를 준다 — 이유는 `useBars`의 같은 옵션 JSDoc.
     */
    refetchEnabled?: boolean;
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
    refetchEnabled = true,
}: UseFearGreedFromSymbolInput): SymbolFearGreedSeries {
    const queryKey = useMemo(
        () => QUERY_KEYS.symbolFearGreed(symbol, fmpSymbol),
        [symbol, fmpSymbol]
    );
    const { data } = useSuspenseQuery({
        queryKey,
        queryFn: ({ queryKey: [, qSymbol, qFmpSymbol] }) =>
            getSymbolFearGreedAction(qSymbol, qFmpSymbol),
        // 사람 입력 전에는 seed를 신선한 값으로 취급해 크롤러 렌더마다 나가는 재조회를 없앤다.
        staleTime: refetchEnabled ? SYMBOL_FEAR_GREED_STALE_TIME_MS : Infinity,
    });
    useRefetchStaleOnEnable(queryKey, refetchEnabled);
    return data;
}
