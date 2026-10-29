'use client';

/**
 * Client-side logout: clears the signed-in member's React Query cache, then
 * runs the logout Server Action (which redirects).
 */

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logoutAction } from '../actions/logoutAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/** State and trigger returned by `useLogout`. */
export interface UseLogoutResult {
    /** True from the click until the redirect lands. */
    pending: boolean;
    /** Starts the logout. */
    logout: () => void;
}

/**
 * Queries whose data belongs to the signed-in member. The post-logout redirect
 * is a soft navigation, so the cache survives it: a stale entry would let the
 * next member who signs in on the same tab see the prior member's data (or,
 * for registered providers, skip the BYOK gate on the prior member's keys)
 * until the entry goes stale and refetches.
 */
const MEMBER_SCOPED_QUERY_KEYS = [
    QUERY_KEYS.portfolioHoldings(),
    QUERY_KEYS.watchlist(),
    QUERY_KEYS.emailReportSettings(),
    QUERY_KEYS.registeredProviders(),
] as const;

/** Logout trigger for the user menu; `pending` stays true until the redirect. */
export function useLogout(): UseLogoutResult {
    const [pending, startTransition] = useTransition();
    const queryClient = useQueryClient();
    const logout = () =>
        startTransition(async () => {
            // Flip the header to the guest state immediately, before the action round-trip.
            queryClient.setQueryData(QUERY_KEYS.currentUser(), null);
            MEMBER_SCOPED_QUERY_KEYS.forEach(queryKey =>
                queryClient.removeQueries({ queryKey })
            );
            await logoutAction();
        });
    return { pending, logout };
}
