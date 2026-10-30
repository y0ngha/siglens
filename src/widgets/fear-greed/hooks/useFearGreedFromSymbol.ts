'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getSymbolFearGreedAction } from '@/entities/bars/actions/getSymbolFearGreedAction';
import type { SymbolFearGreedSeries } from '@/entities/bars/model';
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
     * 이후"일 때만 `true`를 준다 — 하이드레이션 직후 재조회 결과가 서버 HTML과 달라 생기는
     * 불일치와, 크롤러 렌더마다 나가는 재조회를 막기 위해서다.
     */
    refetchEnabled?: boolean;
}

/** 서버 계산 결과와, 그 값이 쿼리 캐시에 들어온 시각(밀리초). */
export interface UseFearGreedFromSymbolResult extends SymbolFearGreedSeries {
    /**
     * 현재 `snapshot`·`history`를 받은 시각. seed는 서버가 마지막 완료 봉 시각으로 고정하고,
     * 재조회가 새 값을 가져오면 갱신된다 — 공유 등록이 "새 스냅샷이 왔다"를 알아보는 기준이다.
     */
    dataUpdatedAt: number;
}

/**
 * 종목 공포·탐욕 snapshot + history. 일봉 기준이고, 점수는 항상 서버가 5년 일봉으로 계산한
 * 값이다(`getSymbolFearGreedAction`). 클라이언트에서 더 짧은 봉으로 다시 계산하지 않아야
 * 헤더 배지·요약·게이지가 같은 날 같은 점수를 보인다. 페이지가 서버 계산값으로 이 쿼리를 seed한다.
 */
export function useFearGreedFromSymbol({
    symbol,
    fmpSymbol,
    refetchEnabled = true,
}: UseFearGreedFromSymbolInput): UseFearGreedFromSymbolResult {
    const queryKey = useMemo(
        () => QUERY_KEYS.symbolFearGreed(symbol, fmpSymbol),
        [symbol, fmpSymbol]
    );
    const { data, dataUpdatedAt } = useSuspenseQuery({
        queryKey,
        queryFn: ({ queryKey: [, qSymbol, qFmpSymbol] }) =>
            getSymbolFearGreedAction(qSymbol, qFmpSymbol),
        // 사람 입력 전에는 seed를 신선한 값으로 취급해 크롤러 렌더마다 나가는 재조회를 없앤다.
        staleTime: refetchEnabled ? SYMBOL_FEAR_GREED_STALE_TIME_MS : Infinity,
    });
    useRefetchStaleOnEnable(queryKey, refetchEnabled);
    return { ...data, dataUpdatedAt };
}
