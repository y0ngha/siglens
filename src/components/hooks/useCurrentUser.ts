'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuthUserRecord } from '@y0ngha/siglens-core';
import { currentUserAction } from '@/infrastructure/auth/currentUserAction';
import {
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
} from '@/lib/queryConfig';

export function useCurrentUser() {
    return useQuery<AuthUserRecord | null>({
        queryKey: QUERY_KEYS.currentUser(),
        queryFn: () => currentUserAction(),
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
    });
}
