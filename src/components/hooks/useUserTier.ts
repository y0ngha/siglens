'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import { getUserTierAction } from '@/infrastructure/tier/getUserTierAction';
import {
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    USER_TIER_STALE_TIME_MS,
} from '@/lib/queryConfig';

interface UseUserTierResult {
    /** Resolved tier for the current user, or {@link DEFAULT_TIER} during fetch. */
    tier: Tier;
    /** True until the first server response lands. */
    isLoading: boolean;
    query: UseQueryResult<Tier>;
}

/**
 * Resolves the current user's subscription tier on the client. Mirrors
 * {@link import('./useCurrentUser').useCurrentUser} in shape; guests and
 * users without a persisted tier degrade to {@link DEFAULT_TIER}.
 */
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
        query,
    };
}
