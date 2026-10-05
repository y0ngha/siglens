vi.mock('@/entities/auth/actions/currentUserAction', () => ({
    currentUserAction: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    DEFAULT_TIER: 'free',
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { currentUserAction } from '@/entities/auth/actions/currentUserAction';
import { useUserTier } from '@/features/symbol-model/hooks/useUserTier';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('useUserTier', () => {
    // `useCurrentUser`는 로그인 힌트 쿠키가 없으면 서버 액션을 부르지 않고 null로 확정한다.
    // 액션 결과를 보는 테스트는 로그인 상태(힌트 있음)를 전제한다.
    beforeEach(() => {
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=1; path=/`;
    });

    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=; max-age=0; path=/`;
    });

    it('returns DEFAULT_TIER while loading', () => {
        (currentUserAction as ReturnType<typeof vi.fn>).mockImplementation(
            () => new Promise(() => {})
        );

        const { result } = renderHook(() => useUserTier(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.tier).toBe('free');
        expect(result.current.isLoading).toBe(true);
    });

    it('returns fetched tier after resolving', async () => {
        (currentUserAction as ReturnType<typeof vi.fn>).mockResolvedValue({
            tier: 'premium',
        });

        const { result } = renderHook(() => useUserTier(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.tier).toBe('premium');
        });

        expect(result.current.isLoading).toBe(false);
    });

    it('returns DEFAULT_TIER for guests (null user)', async () => {
        (currentUserAction as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const { result } = renderHook(() => useUserTier(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.tier).toBe('free');
    });

    it('falls back to DEFAULT_TIER on error', async () => {
        (currentUserAction as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('fetch failed')
        );

        const { result } = renderHook(() => useUserTier(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.tier).toBe('free');
    });
});
