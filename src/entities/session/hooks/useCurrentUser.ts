'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { currentUserAction } from '@/entities/session/actions';
import {
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { isClientRendering } from '@/shared/lib/isClientRendering';

export function useCurrentUser(): UseQueryResult<AuthUserRecord | null> {
    return useQuery<AuthUserRecord | null>({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: () => currentUserAction(),
        enabled: isClientRendering(),
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
    });
}
