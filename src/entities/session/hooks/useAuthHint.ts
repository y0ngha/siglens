'use client';

import { useHydrated } from '@/shared/hooks/useHydrated';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

/**
 * hydration 이후 `document.cookie`에서 hint 쿠키(`siglens_auth`, non-httpOnly) 존재
 * 여부를 읽는다. SSR/첫 render에선 false를 반환해 정적 셸이 모든 방문자에게 동일하게
 * 캐시되도록 한다(hydration mismatch 방지). 값이 비어 있으면(로그아웃 clear) false.
 *
 * 실제 인증이 아니라 hydration 동안의 낙관적 skeleton 추정에만 쓰인다 — 진짜 상태는
 * useCurrentUser(currentUserAction → httpOnly 세션 + DB)가 확정한다.
 */
export function useAuthHint(): boolean {
    const isHydrated = useHydrated();
    if (!isHydrated) return false;
    const prefix = `${AUTH_HINT_COOKIE_NAME}=`;
    const entry = document.cookie.split('; ').find(c => c.startsWith(prefix));
    return !!entry && entry.slice(prefix.length).length > 0;
}
