'use client';

import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';

interface UseUserTierResult {
    /** Resolved tier for the current user, or {@link DEFAULT_TIER} for guests / during fetch. */
    tier: Tier;
    /** True until the first currentUser response lands. */
    isLoading: boolean;
}

/**
 * 현재 사용자의 구독 tier — `currentUser`에 실린 값을 그대로 쓴다.
 *
 * 예전에는 tier만 따로 `['user-tier']` 쿼리(5분 stale)로 들고 있었는데, 로그인·가입은
 * 서버 `redirect()`로 끝나는 soft navigation이라 쿼리 캐시가 살아남고 그 키를
 * 무효화하는 곳이 없었다. 비로그인으로 둘러본 뒤 로그인한 멤버가 최대 5분간 `free`로
 * 보여 분봉·시간봉 타임프레임이 잠겼다. `currentUser`는 헤더가 매 navigation마다
 * refetch하므로 로그인 직후 바로 멤버 tier가 반영된다. 게스트(`null`)와 조회 실패는
 * {@link DEFAULT_TIER}로 폴백한다 — 서버 게이트가 진짜 판정이라 여기서 낙관하지 않는다.
 */
export function useUserTier(): UseUserTierResult {
    const { data: user, isPending } = useCurrentUser();

    return {
        tier: user?.tier ?? DEFAULT_TIER,
        isLoading: isPending,
    };
}
