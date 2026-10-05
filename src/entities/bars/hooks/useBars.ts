'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { Bar, IndicatorResult, Timeframe } from '@y0ngha/siglens-core';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { BARS_STALE_TIME_MS, QUERY_KEYS } from '@/shared/config/queryConfig';
import { useRefetchStaleOnEnable } from '@/shared/hooks/useRefetchStaleOnEnable';

interface UseBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    fmpSymbol?: string;
    /**
     * 시드가 있을 때 마운트 직후 전체 재조회를 시작해도 되는지(기본 true).
     * 이유와 전환 규칙은 훅 JSDoc 참고.
     */
    refetchEnabled?: boolean;
}

interface UseBarsResult {
    bars: Bar[];
    indicators: IndicatorResult;
}

/**
 * 봉 + 지표. 서버가 seed한 축소 지표를 **전체 지표로 복원**하는 재조회가 핵심 동작이다
 * (`getSeedBarsStatic` JSDoc — seed의 `dataUpdatedAt`이 수 시간 전이라 30초 staleTime에는 항상
 * stale로 판정돼 마운트 직후 원본으로 교체된다).
 *
 * ## `refetchEnabled` — 크롤러 렌더마다 나가는 Server Action을 줄인다 (2026-10-05 운영 크롤)
 *
 * 그 재조회는 사람이 쓰는 값(오버레이·지표 창)을 위한 것이다. 렌더만 하고 떠나는 크롤러에게는
 * 매 페이지 한 번의 `getBarsAction` POST가 낭비다. 그래서 호출부가 "사람 상호작용 이후 또는
 * 저장된 차트 설정이 있는 방문자"일 때, **그리고 seed에 형성 중 봉이 빠져 있을 때**(정규장 중 —
 * 분석 작도가 seed 봉에 맞지 않는다) `true`를 준다(`shouldRefetchBarsSeed`; UA 분기 없음 — 모든
 * 방문자에게 같은 규칙).
 *
 * `false`인 동안 `staleTime`을 `Infinity`로 둬 시드를 신선한 값으로 취급하고(마운트 재조회 없음),
 * `true`가 되면 원래 staleTime으로 돌린다. 시드가 **없으면**(캐시 미스·타임프레임 전환) 이 값과
 * 무관하게 일반 조회가 돈다 — 데이터가 없는 쿼리는 stale 여부와 상관없이 fetch한다.
 *
 * ⚠️ TanStack Query는 observer 옵션에서 `staleTime`만 바뀌면 재조회를 시작하지 않는다.
 * 그래서 `false → true` 전환의 재조회는 `useRefetchStaleOnEnable`이 명시적으로 건다.
 */
export function useBars({
    symbol,
    timeframe,
    fmpSymbol,
    refetchEnabled = true,
}: UseBarsOptions): UseBarsResult {
    const queryKey = useMemo(
        () => QUERY_KEYS.bars(symbol, timeframe, fmpSymbol),
        [symbol, timeframe, fmpSymbol]
    );
    const { data } = useSuspenseQuery({
        queryKey,
        queryFn: ({ queryKey: [, qSymbol, qTimeframe, qFmpSymbol] }) =>
            getBarsAction(qSymbol, qTimeframe, qFmpSymbol),
        // OHLCV bars update on the order of seconds during market hours; a
        // short staleTime keeps repaints fresh without thrashing the API.
        staleTime: refetchEnabled ? BARS_STALE_TIME_MS : Infinity,
    });

    // `false → true` 전환(첫 사람 입력)에서 stale인 seed를 한 번 복원한다 — RQ가 staleTime
    // 변경만으로는 재조회하지 않기 때문이다(`useRefetchStaleOnEnable` JSDoc).
    useRefetchStaleOnEnable(queryKey, refetchEnabled);

    return { bars: data.bars, indicators: data.indicators };
}
