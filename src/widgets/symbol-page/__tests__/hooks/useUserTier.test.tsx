vi.mock('@/entities/user-tier/actions', () => ({
    getUserTierAction: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    DEFAULT_TIER: 'free',
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getUserTierAction } from '@/entities/user-tier/actions';
import { useUserTier } from '@/widgets/symbol-page/hooks/useUserTier';

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
    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('returns DEFAULT_TIER while loading', () => {
        (getUserTierAction as ReturnType<typeof vi.fn>).mockImplementation(
            () => new Promise(() => {})
        );

        const { result } = renderHook(() => useUserTier(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.tier).toBe('free');
        expect(result.current.isLoading).toBe(true);
    });

    it('returns fetched tier after resolving', async () => {
        (getUserTierAction as ReturnType<typeof vi.fn>).mockResolvedValue(
            'premium'
        );

        const { result } = renderHook(() => useUserTier(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.tier).toBe('premium');
        });

        expect(result.current.isLoading).toBe(false);
    });

    it('falls back to DEFAULT_TIER on error', async () => {
        (getUserTierAction as ReturnType<typeof vi.fn>).mockRejectedValue(
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
