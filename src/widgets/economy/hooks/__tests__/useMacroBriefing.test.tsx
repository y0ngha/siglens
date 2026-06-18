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

    it('peekSeed가 있으면 hydrate 이전엔 cached seedInput으로 노출 (generatedAt=null)', async () => {
        mockUseHydrated.mockReturnValueOnce(false);
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });
        expect(result.current.input).toEqual({
            status: 'cached',
            briefing: PEEK,
            generatedAt: null,
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

    // M2: mount-only 호출 검증 — useQuery + staleTime:Infinity가 re-render에서 재호출 차단
    it('useMacroBriefing은 mount 당 submitMacroBriefingAction을 1회만 호출한다 (re-render 무관)', async () => {
        mockSubmit.mockResolvedValue({
            briefing: {
                status: 'cached',
                briefing: PEEK,
                generatedAt: '2026-06-17T00:00:00Z',
            },
            botBlocked: false,
        });
        const { result, rerender } = renderHook(() => useMacroBriefing(null), {
            wrapper: makeWrapper(),
        });
        // action이 완료될 때까지 대기
        await waitFor(() => expect(result.current.input).not.toBeUndefined());
        // 여러 번 re-render
        rerender();
        rerender();
        rerender();
        // 여전히 1회만 호출되어야 한다 (staleTime:Infinity로 QueryClient 캐시 재사용)
        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    // T2: peekSeed 잔존 + action error 도착 → stale seed 회귀 방지
    it('peekSeed 잔존 + action error 도착 → input="error" (stale seed 회귀 가드)', async () => {
        /**
         * peekSeed가 있는 상태에서 action이 ok=false를 반환하면,
         * seedInput(cached variant)이 아니라 'error'로 교체되어야 한다.
         * 이를 검증해 "에러를 무시하고 stale seed를 계속 표시"하는 회귀를 방지한다.
         */
        mockSubmit.mockResolvedValue({ ok: false, error: 'server_error' });
        const { result } = renderHook(() => useMacroBriefing(PEEK), {
            wrapper: makeWrapper(),
        });
        // action 완료 후 seedInput이 아닌 'error'가 반환되어야 한다
        await waitFor(() => expect(result.current.input).toBe('error'));
    });
});
