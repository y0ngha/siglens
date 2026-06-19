/**
 * Branch coverage tests for useCongressTrend — targets previously-uncovered
 * branches: pagehide cancel (getPageHideJobs), unmount cancel (jobId != null
 * path, cancel-failed warn), poll ceiling → error, non-Error query error
 * wrapping, hydration gate, and the skip-refetch path.
 *
 * Mirror of useFinancialsAnalysisBranches.test.tsx style.
 */

import type { MockedFunction, Mock } from 'vitest';
import { useCongressTrend } from '@/widgets/congress/hooks/useCongressTrend';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { usePageHideCancel } from '@/shared/hooks/usePageHideCancel';
import {
    cancelCongressTrendJobAction,
    pollCongressTrendAction,
    submitCongressTrendAction,
} from '@/entities/analysis/actions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { CongressTrendResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/analysis/actions', () => ({
    submitCongressTrendAction: vi.fn(),
    pollCongressTrendAction: vi.fn(),
    cancelCongressTrendJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/hooks/usePageHideCancel', () => ({
    usePageHideCancel: vi.fn(),
}));

vi.mock('@/widgets/symbol-page', () => ({
    BotBlockedError: class BotBlockedError extends Error {
        constructor() {
            super('bot_blocked');
            this.name = 'BotBlockedError';
        }
    },
}));

// SSR hydration gate — default hydrated so tests auto-trigger on mount.
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

const mockSubmit = submitCongressTrendAction as MockedFunction<
    typeof submitCongressTrendAction
>;
const mockPoll = pollCongressTrendAction as MockedFunction<
    typeof pollCongressTrendAction
>;
const mockCancel = cancelCongressTrendJobAction as MockedFunction<
    typeof cancelCongressTrendJobAction
>;
const mockUseHydrated = vi.mocked(useHydrated);
const mockUsePageHideCancel = usePageHideCancel as unknown as Mock;

const CONGRESS_RESULT: CongressTrendResponse = {
    summaryKo: '의회 매수세 우위',
    notableMembersKo: ['Nancy Pelosi'],
    riskNoteKo: '공시 지연 위험',
    overallSentiment: 'bullish',
};

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

describe('useCongressTrend — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        mockUseHydrated.mockReturnValue(true);
        mockUsePageHideCancel.mockReset();
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    describe('pagehide/unmount cleanup', () => {
        it('getPageHideJobs: jobId가 있으면 ref를 null로 비우고 엔트리를 반환한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-pagehide-1',
            });
            // poll이 완료되기 전에 pagehide를 시뮬레이션한다.
            // sleep은 즉시 resolve되지만 poll 완료 전에 getPageHideJobs를 호출한다.
            mockPoll.mockReturnValue(new Promise(() => {})); // 절대 resolve하지 않음

            // usePageHideCancel mock이 첫 번째 인자(getPageHideJobs)를 캡처한다.
            let capturedGetJobs:
                | (() => ReturnType<typeof usePageHideCancel>)
                | null = null;
            mockUsePageHideCancel.mockImplementation((fn: () => unknown) => {
                capturedGetJobs = fn as () => ReturnType<
                    typeof usePageHideCancel
                >;
            });

            const wrapper = makeWrapper();
            renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                {
                    wrapper,
                }
            );

            // submit이 완료돼 jobId가 ref에 저장될 때까지 대기
            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
            // sleep이 즉시 resolve되므로 onJobId(submitted.jobId)도 호출됐을 것.
            // 짧은 대기로 microtask flush
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
            });

            expect(capturedGetJobs).not.toBeNull();

            // getPageHideJobs 호출 — jobId가 있는 경우
            const jobs = capturedGetJobs!();
            expect(jobs).toEqual([
                { jobId: 'job-pagehide-1', type: 'congress' },
            ]);
        });

        it('getPageHideJobs: jobId가 없으면 null을 반환한다', async () => {
            // cached → jobId가 설정되지 않음
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: CONGRESS_RESULT,
            });

            let capturedGetJobs: (() => unknown) | null = null;
            mockUsePageHideCancel.mockImplementation((fn: () => unknown) => {
                capturedGetJobs = fn;
            });

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            expect(capturedGetJobs).not.toBeNull();
            // cached path → jobId ref == null
            expect(capturedGetJobs!()).toBeNull();
        });

        it('unmount 시 jobId가 없으면 cancel을 호출하지 않는다', async () => {
            // cached → jobId가 설정되지 않음
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: CONGRESS_RESULT,
            });

            const wrapper = makeWrapper();
            const { result, unmount } = renderHook(
                () => useCongressTrend('MSFT', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            unmount();

            await new Promise(resolve => setTimeout(resolve, 0));
            // cached path → jobId ref는 null → cancel 미호출
            expect(mockCancel).not.toHaveBeenCalled();
        });

        it('unmount cancel 실패는 warn만 출력하고 에러를 던지지 않는다 (lines ~161-162)', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-cancel-fail',
            });
            // poll이 never resolve → unmount 시 jobId ref가 null이 아님
            mockPoll.mockReturnValue(new Promise(() => {}));
            mockCancel.mockRejectedValue(new Error('cancel network error'));

            const wrapper = makeWrapper();
            const { unmount } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            // submit 완료 + onJobId 호출 대기
            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
            });

            // unmount → cleanup → cancel 실패 → warn
            unmount();

            await waitFor(() => {
                expect(mockCancel).toHaveBeenCalledWith('job-cancel-fail');
            });

            await new Promise(resolve => setTimeout(resolve, 20));
            // uncaught rejection이 없어야 한다 — warn만 호출됨
            expect(warnSpy).toHaveBeenCalledWith(
                '[useCongressTrend] cancel failed',
                expect.any(Error)
            );

            warnSpy.mockRestore();
        });
    });

    describe('poll ceiling', () => {
        it('폴링이 5분 초과하면 error 상태로 전환된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-ceiling-1',
            });
            // sleep이 즉시 resolve되고 ceiling 체크가 첫 반복에서 발동한다.
            mockPoll.mockResolvedValue({ status: 'processing' } as never);

            const now = 1_700_000_000_000;
            const dateSpy = vi
                .spyOn(Date, 'now')
                .mockReturnValueOnce(now) // pollStartTime 기록 시
                .mockReturnValue(now + 5 * 60 * 1000 + 1); // 첫 번째 ceiling 체크 시

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('error');
            });

            dateSpy.mockRestore();

            if (result.current.status !== 'error') {
                throw new Error('expected error state');
            }
            expect(result.current.error.message).toContain('응답하지 않습니다');
        });

        it('poll ceiling error 후 retry하면 캐시 히트로 복구된다', async () => {
            mockSubmit.mockResolvedValueOnce({
                status: 'submitted',
                jobId: 'job-ceiling-retry',
            });
            mockPoll.mockResolvedValue({ status: 'processing' } as never);

            const now = 1_700_000_000_000;
            const dateSpy = vi
                .spyOn(Date, 'now')
                .mockReturnValueOnce(now)
                .mockReturnValue(now + 5 * 60 * 1000 + 1);

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('error');
            });

            dateSpy.mockRestore();

            mockSubmit.mockResolvedValueOnce({
                status: 'cached',
                result: CONGRESS_RESULT,
            });

            if (result.current.status !== 'error') {
                throw new Error('expected error state');
            }

            const state = result.current;
            act(() => {
                state.retry();
            });

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });
            expect(mockSubmit).toHaveBeenCalledTimes(2);
        });
    });

    describe('에러 처리', () => {
        it('non-Error query error는 Error로 래핑된다', async () => {
            mockSubmit.mockRejectedValue('string_error');

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('error');
            });

            if (result.current.status !== 'error') {
                throw new Error('expected error state');
            }
            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.error.message).toContain(
                '오류가 발생했습니다'
            );
        });

        it('poll이 error 상태를 반환하면 error 메시지로 throw된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-poll-error-1',
            });
            mockPoll.mockResolvedValueOnce({
                status: 'error',
                error: '분석 워커 오류',
            });

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('error');
            });

            if (result.current.status !== 'error') {
                throw new Error('expected error state');
            }
            expect(result.current.error.message).toBe('분석 워커 오류');
        });

        it('poll error에 메시지가 없으면 기본 메시지가 사용된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-poll-error-2',
            });
            mockPoll.mockResolvedValueOnce({
                status: 'error',
            } as { status: 'error'; error: string });

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('error');
            });

            if (result.current.status !== 'error') {
                throw new Error('expected error state');
            }
            expect(result.current.error.message).toContain(
                '오류가 발생했습니다'
            );
        });
    });

    describe('hydration gate', () => {
        it('SSR 하이드레이션 게이트가 닫혀 있으면 fetch를 실행하지 않는다', async () => {
            mockUseHydrated.mockReturnValue(false);

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockSubmit).not.toHaveBeenCalled();
            expect(result.current.status).toBe('loading');
        });

        it('쿼리 데이터가 이미 존재하면 refetch를 건너뛴다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: CONGRESS_RESULT,
            });

            const wrapper = makeWrapper();
            const { result, rerender } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            rerender();

            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });
});
