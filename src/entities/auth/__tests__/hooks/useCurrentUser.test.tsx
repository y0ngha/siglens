const { mockCurrentUserAction } = vi.hoisted(() => ({
    mockCurrentUserAction: vi.fn(),
}));

vi.mock('@/entities/auth/actions', () => ({
    currentUserAction: mockCurrentUserAction,
}));

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
    });
    function TestQueryWrapper({
        children,
    }: {
        children: React.ReactNode;
    }): React.ReactElement {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }
    return TestQueryWrapper;
}

const mockUser: AuthUserRecord = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    tier: 'free',
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('useCurrentUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns user data on success', async () => {
        mockCurrentUserAction.mockResolvedValue(mockUser);

        const { result } = renderHook(() => useCurrentUser(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockUser);
        expect(mockCurrentUserAction).toHaveBeenCalledTimes(1);
    });

    it('returns null when no user is logged in', async () => {
        mockCurrentUserAction.mockResolvedValue(null);

        const { result } = renderHook(() => useCurrentUser(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toBeNull();
    });

    it('enters error state when the action throws', async () => {
        mockCurrentUserAction.mockRejectedValue(new Error('network error'));

        const { result } = renderHook(() => useCurrentUser(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeInstanceOf(Error);
    });

    it('starts in pending state before data loads', () => {
        mockCurrentUserAction.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useCurrentUser(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.isPending).toBe(true);
        expect(result.current.data).toBeUndefined();
    });
});
