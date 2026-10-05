const { mockCurrentUserAction } = vi.hoisted(() => ({
    mockCurrentUserAction: vi.fn(),
}));

vi.mock('@/entities/auth/actions/currentUserAction', () => ({
    currentUserAction: mockCurrentUserAction,
}));

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';
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

function setHint(): void {
    document.cookie = `${AUTH_HINT_COOKIE_NAME}=1; path=/`;
}
function clearHint(): void {
    document.cookie = `${AUTH_HINT_COOKIE_NAME}=; max-age=0; path=/`;
}

describe('useCurrentUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 기본은 로그인 힌트 있음 — 액션 경로를 밟는다.
        setHint();
    });

    afterEach(() => {
        clearHint();
    });

    it('힌트 쿠키가 없으면 서버 액션을 부르지 않고 null로 확정한다', async () => {
        clearHint();

        const { result } = renderHook(() => useCurrentUser(), {
            wrapper: makeWrapper(),
        });

        // 쿼리는 돌아 success로 끝나야 한다 — pending에 갇히면 소비자가 스켈레톤에 남는다.
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toBeNull();
        expect(mockCurrentUserAction).not.toHaveBeenCalled();
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
