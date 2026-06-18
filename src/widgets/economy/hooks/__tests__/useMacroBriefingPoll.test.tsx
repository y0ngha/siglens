vi.mock('@/entities/economy/actions/pollMacroBriefingAction');
vi.mock('@/shared/hooks/useHydrated');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useMacroBriefingPoll } from '@/widgets/economy/hooks/useMacroBriefingPoll';
import { pollMacroBriefingAction } from '@/entities/economy/actions/pollMacroBriefingAction';
import { useHydrated } from '@/shared/hooks/useHydrated';

const mockPoll = vi.mocked(pollMacroBriefingAction);
const mockUseHydrated = vi.mocked(useHydrated);

interface WrapperProps {
    children: React.ReactNode;
}

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function QueryWrapper({ children }: WrapperProps) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('useMacroBriefingPoll', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseHydrated.mockReturnValue(true);
    });

    it('미하이드레이션이면 processing 반환(쿼리 disabled)', () => {
        mockUseHydrated.mockReturnValueOnce(false);
        const { result } = renderHook(() => useMacroBriefingPoll('j'), {
            wrapper: makeWrapper(),
        });
        expect(result.current).toEqual({ status: 'processing' });
        expect(mockPoll).not.toHaveBeenCalled();
    });

    it('action processing → processing', async () => {
        mockPoll.mockResolvedValue({ status: 'processing' });
        const { result } = renderHook(() => useMacroBriefingPoll('j'), {
            wrapper: makeWrapper(),
        });
        await waitFor(() =>
            expect(result.current).toEqual({ status: 'processing' })
        );
    });

    it('action done → done variant 전달', async () => {
        mockPoll.mockResolvedValue({
            status: 'done',
            briefing: { summary: 's', highlights: [], regime: 'neutral' },
            generatedAt: '2026-06-17T00:00:00Z',
        });
        const { result } = renderHook(() => useMacroBriefingPoll('j'), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => {
            expect(result.current.status).toBe('done');
            if (result.current.status === 'done') {
                expect(result.current.briefing.summary).toBe('s');
                expect(result.current.generatedAt).toBe('2026-06-17T00:00:00Z');
            }
        });
    });

    it('action error → error variant 전달(throw 없이 inline notice)', async () => {
        mockPoll.mockResolvedValue({
            status: 'error',
            error: 'worker boom',
        });
        const { result } = renderHook(() => useMacroBriefingPoll('j'), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => {
            expect(result.current.status).toBe('error');
            if (result.current.status === 'error') {
                expect(result.current.error).toBe('worker boom');
            }
        });
    });
});
