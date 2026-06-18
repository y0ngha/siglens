vi.mock('@/entities/economy/actions/submitMacroBriefingAction');
vi.mock('@/shared/hooks/useHydrated');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { useMacroBriefing } from '@/widgets/economy/hooks/useMacroBriefing';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';
import { useHydrated } from '@/shared/hooks/useHydrated';

const mockSubmit = vi.mocked(submitMacroBriefingAction);
const mockUseHydrated = vi.mocked(useHydrated);

const PEEK: MacroBriefingResponse = {
    summary: 'peek summary',
    highlights: [],
    regime: 'neutral',
};

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

describe('useMacroBriefing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseHydrated.mockReturnValue(true);
    });

    it('peekSeed가 있으면 hydrate 이전엔 cached seedInput으로 노출', async () => {
        mockUseHydrated.mockReturnValueOnce(false);
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });
        expect(result.current.input).toEqual({
            status: 'cached',
            briefing: PEEK,
            generatedAt: '',
        });
    });

    it('peekSeed가 없고 data 미도착이면 undefined', () => {
        mockSubmit.mockReturnValue(new Promise(() => {}));
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        expect(result.current.input).toBeUndefined();
    });

    it('action이 cached briefing 반환 → input=briefing', async () => {
        mockSubmit.mockResolvedValue({
            briefing: {
                status: 'cached',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            },
            botBlocked: false,
        });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() =>
            expect(result.current.input).toEqual({
                status: 'cached',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            })
        );
    });

    it('action이 submitted 반환 → input=submitted variant', async () => {
        mockSubmit.mockResolvedValue({
            briefing: { status: 'submitted', jobId: 'job-1' },
            botBlocked: false,
        });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() =>
            expect(result.current.input).toEqual({
                status: 'submitted',
                jobId: 'job-1',
            })
        );
    });

    it('botBlocked → input=null', async () => {
        mockSubmit.mockResolvedValue({ briefing: null, botBlocked: true });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.input).toBeNull());
    });

    it('action ok=false → input="error" (silent skeleton 회귀 방지)', async () => {
        mockSubmit.mockResolvedValue({ ok: false, error: 'server_error' });
        const { result } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.input).toBe('error'));
    });
});
