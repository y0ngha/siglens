'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * `enabled`가 **`false → true`로 바뀌는 순간** 그 쿼리가 stale이면 한 번 재조회한다.
 *
 * ## 왜 필요한가
 *
 * seed가 있는 쿼리의 마운트 재조회를 막으려고 호출부가 `staleTime`을 `Infinity`로 뒀다가
 * 나중에 원래 값으로 돌리면, TanStack Query는 **stale 타이머만 갱신하고 재조회는 시작하지
 * 않는다**(`QueryObserver.setOptions`의 `shouldFetchOptionally`는 쿼리 교체·`enabled` 전환만
 * 본다). 그래서 "나중에 켜졌을 때 한 번"은 이 훅이 명시적으로 건다. `useBars`·
 * `useFearGreedFromSymbol` 테스트가 이 동작을 고정한다.
 *
 * - `stale: true`: 방금 받은 신선한 데이터는 건드리지 않는다(중복 요청 없음).
 * - 첫 렌더에 이미 `true`면 부르지 않는다 — 그 경우는 RQ의 마운트 재조회가 이미 돈다.
 *
 * 호출 순서: 이 훅은 `useSuspenseQuery`/`useQuery`**보다 뒤**에 둔다. 그래야 observer가 새
 * `staleTime`을 반영한 뒤에 stale 판정을 한다.
 *
 * `queryKey`는 렌더 간 참조가 안정적이어야 한다(`useMemo`) — 아니면 effect가 매 렌더 돈다.
 */
export function useRefetchStaleOnEnable(
    queryKey: QueryKey,
    enabled: boolean
): void {
    const queryClient = useQueryClient();
    const wasEnabledRef = useRef(enabled);
    useEffect(() => {
        const wasEnabled = wasEnabledRef.current;
        wasEnabledRef.current = enabled;
        if (!enabled || wasEnabled) return;
        void queryClient.refetchQueries({ queryKey, stale: true, exact: true });
    }, [enabled, queryClient, queryKey]);
}
