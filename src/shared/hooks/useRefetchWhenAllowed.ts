'use client';

import { useEffect } from 'react';

/**
 * 캐시 전용 조회가 미스로 끝나 대기 중인 쿼리를, 게이트가 열리는 순간 한 번 다시
 * 부른다. 이번에는 `allowed`가 참이라 쿼리 함수가 일반 요청(생성 포함)을 보낸다.
 *
 * `refetch`는 React Query가 안정 참조를 보장한다.
 */
export function useRefetchWhenAllowed(
    allowed: boolean,
    isAwaiting: boolean,
    refetch: () => unknown
): void {
    useEffect(() => {
        if (allowed && isAwaiting) void refetch();
    }, [allowed, isAwaiting, refetch]);
}
