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
            await logoutAction();
        });
    return { pending, logout };
}
