vi.mock('@/entities/economy/actions/pollMacroBriefingAction');
vi.mock('@/shared/hooks/useHydrated');

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

    it('jobId가 빈 문자열이면 쿼리가 비활성화되어 poll이 호출되지 않음', () => {
        mockUseHydrated.mockReturnValue(true);
        const { result } = renderHook(() => useMacroBriefingPoll(''), {
            wrapper: makeWrapper(),
        });
        // 쿼리 disabled → data 없음 → processing 반환
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

    it('unmount 시 polling이 중단된다', async () => {
        // processing 상태를 유지해 refetchInterval이 계속 발생할 수 있는 환경을 만든다.
        mockPoll.mockResolvedValue({ status: 'processing' });

        const { unmount } = renderHook(
            () => useMacroBriefingPoll('j-unmount'),
            {
                wrapper: makeWrapper(),
            }
        );

        // 초기 쿼리가 발동될 수 있도록 대기 (실제 타이머 사용 — waitFor 내부가 의존)
        await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(1));

        const callCountBeforeUnmount = mockPoll.mock.calls.length;
        unmount();

        // 초기 waitFor 완료 후 fake 타이머로 전환해 결정적으로 시간을 진행시킨다.
        // refetchInterval(5000ms)보다 충분히 크게 진행해도 추가 poll이 없어야 한다.
        vi.useFakeTimers();
        await vi.advanceTimersByTimeAsync(10000);
        expect(mockPoll.mock.calls.length).toBe(callCountBeforeUnmount);
    });

    afterEach(() => {
        vi.useRealTimers();
    });
});
