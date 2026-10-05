'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { currentUserAction } from '@/entities/auth/actions/currentUserAction';
import {
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { readAuthHintCookie } from '@/shared/lib/auth/readAuthHintCookie';

/**
 * 힌트 쿠키(`siglens_auth`)가 없으면 서버 액션을 **부르지 않고** 곧바로 `null`을 돌려준다.
 *
 * ## 왜 (2026-10-05 운영 크롤)
 *
 * 비로그인 방문자(크롤러 렌더 포함)는 페이지마다 하이드레이션 직후 이 액션으로 POST 한 번을
 * 쏘고 있었다. 결과가 항상 `null`인 호출이다. 로그인(`loginAction`·OAuth 콜백·가입·핸드오프)은
 * 세션 쿠키와 **같이** 힌트 쿠키를 심으므로, 힌트가 없으면 세션도 없다. UA 분기가 아니라 모든
 * 비로그인 방문자에게 같은 규칙이다.
 *
 * `enabled: false`로 막지 않는 이유: 소비자(`isPending`을 로딩으로 읽는 헤더·게이트)가 쿼리가
 * 영영 pending이면 스켈레톤에 갇힌다. 쿼리는 돌되 `queryFn`이 즉시 `null`로 확정한다.
 *
 * 힌트는 인증 근거가 아니다 — 힌트가 있으면 여전히 액션이 httpOnly 세션을 DB로 확정하고,
 * 죽은 세션이면 쿠키(세션·힌트)를 함께 지운다(`currentUserAction`).
 */
async function fetchCurrentUser(): Promise<AuthUserRecord | null> {
    if (!readAuthHintCookie()) return null;
    return currentUserAction();
}

export function useCurrentUser(): UseQueryResult<AuthUserRecord | null> {
    const isHydrated = useHydrated();
    return useQuery<AuthUserRecord | null>({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: fetchCurrentUser,
        enabled: isHydrated,
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
    });
}
