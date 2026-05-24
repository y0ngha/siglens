'use client';

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import { getUserTierAction } from '@/infrastructure/tier/getUserTierAction';
import {
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    USER_TIER_STALE_TIME_MS,
} from '@/shared/config/queryConfig';

interface UseUserTierResult {
    /** Resolved tier for the current user, or {@link DEFAULT_TIER} during fetch. */
    tier: Tier;
    /** True until the first server response lands. */
    isLoading: boolean;
}

/** 현재 사용자의 구독 tier 해석 — 게스트/미저장 사용자는 DEFAULT_TIER로 폴백. */
export function useUserTier(): UseUserTierResult {
    const query = useQuery<Tier>({
        queryKey: QUERY_KEYS.userTier(),
        queryFn: () => getUserTierAction(),
        staleTime: USER_TIER_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
    });

    return {
        tier: query.data ?? DEFAULT_TIER,
        isLoading: query.isLoading,
    };
}
