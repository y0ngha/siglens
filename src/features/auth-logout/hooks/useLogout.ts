'use client';

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logoutAction } from '../actions/logoutAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

interface UseLogoutResult {
    pending: boolean;
    logout: () => void;
}

export function useLogout(): UseLogoutResult {
    const [pending, startTransition] = useTransition();
    const queryClient = useQueryClient();
    const logout = () =>
        startTransition(async () => {
            queryClient.setQueryData(QUERY_KEYS.currentUser(), null);
            // Drop the previous member's holdings from the cache — a stale
            // React Query entry would otherwise let a subsequent user on the
            // same browser briefly see the prior member's holdings before
            // the next authenticated fetch resolves.
            queryClient.removeQueries({
                queryKey: QUERY_KEYS.portfolioHoldings(),
            });
            await logoutAction();
        });
    return { pending, logout };
}
