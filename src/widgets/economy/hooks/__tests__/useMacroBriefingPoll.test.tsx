vi.mock('@/entities/economy/actions/pollMacroBriefingAction');
vi.mock('@/shared/hooks/useHydrated');
vi.mock('@/shared/config/pollingConfig', () => ({
    ANALYSIS_POLL_MAX_DURATION_MS: 50, // 50ms in tests to avoid waiting 5 min
}));

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
        expect(result.current.status).toBe('processing');
        expect(mockPoll).not.toHaveBeenCalled();
    });

    it('jobId가 빈 문자열이면 쿼리가 비활성화되어 poll이 호출되지 않음', () => {
        mockUseHydrated.mockReturnValue(true);
        const { result } = renderHook(() => useMacroBriefingPoll(''), {
            wrapper: makeWrapper(),
        });
        // 쿼리 disabled → data 없음 → processing 반환
        expect(result.current.status).toBe('processing');
        expect(mockPoll).not.toHaveBeenCalled();
    });

    it('action processing → processing', async () => {
        mockPoll.mockResolvedValue({ status: 'processing' });
        const { result } = renderHook(() => useMacroBriefingPoll('j'), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.status).toBe('processing'));
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

    it('반환값에 항상 refetch 콜백이 포함된다', async () => {
        mockPoll.mockResolvedValue({ status: 'processing' });
        const { result } = renderHook(() => useMacroBriefingPoll('j'), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.status).toBe('processing'));
        expect(typeof result.current.refetch).toBe('function');
    });

    it('polling이 ANALYSIS_POLL_MAX_DURATION_MS를 초과하면 error 상태로 전환', async () => {
        // ANALYSIS_POLL_MAX_DURATION_MS는 이 파일의 vi.mock에서 50ms로 오버라이드됨.
        // processing을 계속 반환해 타임아웃이 발생할 조건을 만든다.
        mockPoll.mockResolvedValue({ status: 'processing' });

        const { result } = renderHook(() => useMacroBriefingPoll('j-timeout'), {
            wrapper: makeWrapper(),
        });

        // ceiling 타이머(50ms)가 발동될 때까지 대기.
        await waitFor(
            () => {
                expect(result.current.status).toBe('error');
            },
            { timeout: 500 }
        );

        // error 상태일 때도 refetch 콜백이 있어야 한다(재시도 버튼이 의존).
        if (result.current.status === 'error') {
            expect(typeof result.current.refetch).toBe('function');
        }
    });

    it('retry 후 ceiling이 재무장되어 stall이 지속되면 다시 error로 전환된다', async () => {
        // ANALYSIS_POLL_MAX_DURATION_MS는 vi.mock에서 50ms로 오버라이드됨.
        // processing을 계속 반환해 첫 번째 ceiling을 발동시킨 뒤, refetch()를 호출한다.
        // 버그 코드에서는 isSettled가 false로 유지돼 effect가 재실행되지 않으므로
        // 두 번째 ceiling이 발동되지 않고 status가 'processing'에 머문다.
        // 수정 후에는 pollWindow 카운터 증가로 effect가 재실행되어 다시 'error'로 전환된다.
        mockPoll.mockResolvedValue({ status: 'processing' });

        const { result } = renderHook(
            () => useMacroBriefingPoll('j-retry-rearm'),
            { wrapper: makeWrapper() }
        );

        // 첫 번째 ceiling(50ms) 발동 대기.
        await waitFor(
            () => {
                expect(result.current.status).toBe('error');
            },
            { timeout: 500 }
        );

        // 재시도 — timedOut 초기화 + pollWindow++ + queryRefetch.
        // 잡은 여전히 processing을 반환하므로 두 번째 ceiling이 발동돼야 한다.
        result.current.refetch();

        // refetch() 직후 status가 'processing'으로 돌아왔는지 확인.
        await waitFor(
            () => {
                expect(result.current.status).toBe('processing');
            },
            { timeout: 200 }
        );

        // 두 번째 ceiling(50ms) 발동 대기 — 버그 코드에서는 여기서 timeout.
        await waitFor(
            () => {
                expect(result.current.status).toBe('error');
            },
            { timeout: 500 }
        );

        if (result.current.status === 'error') {
            expect(result.current.error).toBe('poll_timeout');
        }
    });

    it('쿼리 disabled 상태(useHydrated=false)에서는 ceiling 타이머가 발동되지 않는다', async () => {
        // gemini edge-case: when the query is disabled, isSettled stays false
        // but the ceiling timer must NOT arm — otherwise a spurious poll_timeout
        // fires before polling even starts.
        vi.useFakeTimers();
        mockUseHydrated.mockReturnValue(false);

        const { result } = renderHook(
            () => useMacroBriefingPoll('j-disabled'),
            {
                wrapper: makeWrapper(),
            }
        );

        // Advance well past the (mocked 50ms) ceiling.
        await vi.advanceTimersByTimeAsync(200);

        // Must stay 'processing' — no poll_timeout emitted.
        expect(result.current.status).toBe('processing');
        expect(mockPoll).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('jobId가 빈 문자열이면 ceiling 타이머가 발동되지 않는다(disabled query)', async () => {
        // Same disabled-query guard: jobId='' disables the query and must not arm the timer.
        vi.useFakeTimers();
        mockUseHydrated.mockReturnValue(true);

        const { result } = renderHook(() => useMacroBriefingPoll(''), {
            wrapper: makeWrapper(),
        });

        await vi.advanceTimersByTimeAsync(200);

        // Must stay 'processing' — no poll_timeout emitted.
        expect(result.current.status).toBe('processing');
        expect(mockPoll).not.toHaveBeenCalled();

        vi.useRealTimers();
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
