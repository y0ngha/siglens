/**
 * Branch coverage tests for useAnalysis — targets uncovered branches
 * in submit status handlers, polling error paths, cooldown, model change,
 * and timeframe change flows.
 */

import type { MockedFunction, Mock } from 'vitest';
import { useAnalysis } from '@/views/symbol/hooks/useAnalysis';
import {
    cancelAnalysisJobAction,
    pollAnalysisAction,
    submitAnalysisAction,
} from '@/entities/analysis/actions';
import {
    getReanalyzeCooldownMs,
    tryAcquireReanalyzeCooldown,
    releaseReanalyzeCooldown,
} from '@/entities/analysis';
import {
    ANALYSIS_POLL_MAX_DURATION_MS,
    ANALYSIS_POLL_TIMEOUT_MESSAGE,
} from '@/shared/config/pollingConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/analysis/actions', () => ({
    submitAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/entities/analysis', async importOriginal => {
    const actual = await importOriginal<typeof import('@/entities/analysis')>();
    return {
        // 쿨다운 I/O만 스텁하고, normalizeAnalysisResponse 등 순수 함수는 실제 구현을 사용한다.
        ...actual,
        getReanalyzeCooldownMs: vi.fn().mockResolvedValue(0),
        releaseReanalyzeCooldown: vi.fn().mockResolvedValue(undefined),
        tryAcquireReanalyzeCooldown: vi.fn().mockResolvedValue({ ok: true }),
    };
});

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/hooks/usePageHideCancel', () => ({
    usePageHideCancel: vi.fn(),
}));

const mockSubmit = submitAnalysisAction as MockedFunction<
    typeof submitAnalysisAction
>;
const mockPoll = pollAnalysisAction as MockedFunction<
    typeof pollAnalysisAction
>;
const mockCancel = cancelAnalysisJobAction as MockedFunction<
    typeof cancelAnalysisJobAction
>;
const mockTryAcquire = tryAcquireReanalyzeCooldown as Mock;
const mockRelease = releaseReanalyzeCooldown as Mock;

const INITIAL_ANALYSIS = {} as unknown as AnalysisResponse;
const CACHED_RESULT = { summary: 'test' } as unknown as AnalysisResponse;

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
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

interface PartialOptions {
    symbol?: string;
    initialAnalysisFailed?: boolean;
    timeframeChangeCount?: number;
    modelId?: string;
    isModelHydrated?: boolean;
}

function makeOptions(overrides?: PartialOptions) {
    return {
        symbol: overrides?.symbol ?? 'AAPL',
        companyName: 'Apple Inc.',
        timeframe: '1Day' as Timeframe,
        initialAnalysis: INITIAL_ANALYSIS,
        initialAnalysisFailed: overrides?.initialAnalysisFailed ?? false,
        timeframeChangeCount: overrides?.timeframeChangeCount ?? 0,
        modelId: overrides?.modelId as never,
        isModelHydrated: overrides?.isModelHydrated,
    };
}

describe('useAnalysis — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        // mockReset (not just re-stubbing) so call history cannot leak between
        // tests: a `not.toHaveBeenCalled()` assertion further down would
        // otherwise see calls made by an earlier test in this file.
        mockTryAcquire.mockReset();
        mockTryAcquire.mockResolvedValue({ ok: true });
        mockRelease.mockReset();
        mockRelease.mockResolvedValue(undefined);
        (getReanalyzeCooldownMs as Mock).mockResolvedValue(0);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    describe('submit status: cached with force=true (L195-202)', () => {
        it('sets reanalyze cooldown when cached result with force', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: CACHED_RESULT,
                lockedInfoDepth: [],
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisResult).toMatchObject(
                    CACHED_RESULT
                );
            });
        });
    });

    describe('submit status: miss_no_trigger (L208-214)', () => {
        it('sets isBotBlocked when miss_no_trigger', async () => {
            mockSubmit.mockResolvedValue({
                status: 'miss_no_trigger',
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isBotBlocked).toBe(true);
            });
        });
    });

    describe('submit status: key_error (L215-217)', () => {
        it('sets pollError when key_error', async () => {
            mockSubmit.mockResolvedValue({
                status: 'key_error',
                code: 'user_api_key_required',
                error: 'API key invalid',
                modelId: 'gemini-2.5-flash',
                tier: 'free',
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toBe('API key invalid');
            });
        });
    });

    describe('submit status: error (gate/limit) (L218-229)', () => {
        it('sets pollError and releases cooldown for force request', async () => {
            mockSubmit.mockResolvedValue({
                status: 'error',
                error: { code: 'tier_premium_blocked', message: '한도 초과' },
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toBe('한도 초과');
            });
        });
    });

    describe('submit onError: force request releases cooldown (L231-238)', () => {
        it('releases cooldown on mutation error when force=true', async () => {
            mockSubmit.mockRejectedValue(new Error('Network error'));
            mockTryAcquire.mockResolvedValue({ ok: true });

            const { result } = renderHook(() => useAnalysis(makeOptions()), {
                wrapper: makeWrapper(),
            });

            await act(async () => {});

            // Trigger handleReanalyze which uses force=true
            act(() => {
                result.current.handleReanalyze();
            });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalled();
            });

            // Wait for the error to be processed
            await waitFor(() => {
                expect(mockRelease).toHaveBeenCalled();
            });
        });
    });

    describe('polling: done status (L330-338)', () => {
        it('sets analysis result when poll returns done', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-1',
            });
            mockPoll.mockResolvedValueOnce({
                status: 'done',
                result: CACHED_RESULT,
                lockedInfoDepth: [],
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisResult).toMatchObject(
                    CACHED_RESULT
                );
            });
        });
    });

    describe('polling: error status (L339-356)', () => {
        it('sets pollError when poll returns error', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-1',
            });
            mockPoll.mockResolvedValueOnce({
                status: 'error',
                error: '분석 실패',
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toBe('분석 실패');
            });
        });

        it('uses AI_SERVER_UNSTABLE message when error is AI_SERVER_UNSTABLE', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-1',
            });
            mockPoll.mockResolvedValueOnce({
                status: 'error',
                error: 'AI_SERVER_UNSTABLE',
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toContain(
                    'AI 서버가 불안정합니다'
                );
            });
        });
    });

    describe('polling: catch block (L358-371)', () => {
        it('sets generic error when poll throws', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-1',
            });
            mockPoll.mockRejectedValueOnce(new Error('Network failure'));

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toBe(
                    '분석 결과 조회에 실패했습니다.'
                );
            });
        });
    });

    describe('handleReanalyze cooldown (L262-285)', () => {
        it('shows cooldown notice when acquire fails', async () => {
            mockTryAcquire.mockResolvedValue({
                ok: false,
                remainingMs: 180000,
            });

            const { result } = renderHook(() => useAnalysis(makeOptions()), {
                wrapper: makeWrapper(),
            });

            await act(async () => {});

            act(() => {
                result.current.handleReanalyze();
            });

            await waitFor(() => {
                expect(result.current.cooldownNotice).not.toBeNull();
                expect(result.current.reanalyzeCooldownMs).toBe(180000);
            });
        });
    });

    describe('timeframe change (L396-414)', () => {
        it('cancels current job and resubmits on timeframe change', async () => {
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'submitted',
                    jobId: 'job-old',
                })
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: CACHED_RESULT,
                    lockedInfoDepth: [],
                });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { rerender } = renderHook(
                ({ timeframeChangeCount }: { timeframeChangeCount: number }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            timeframeChangeCount,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { timeframeChangeCount: 0 },
                }
            );

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });

            rerender({ timeframeChangeCount: 1 });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('model change (L416-440)', () => {
        it('hydration: syncs prevModelId without triggering reanalysis', async () => {
            const { rerender } = renderHook(
                ({
                    modelId,
                    isModelHydrated,
                }: {
                    modelId: string;
                    isModelHydrated: boolean;
                }) =>
                    useAnalysis({
                        ...makeOptions(),
                        modelId: modelId as never,
                        isModelHydrated,
                    }),
                {
                    wrapper: makeWrapper(),
                    initialProps: {
                        modelId: 'gemini-2.5-flash-lite',
                        isModelHydrated: false,
                    },
                }
            );

            expect(mockSubmit).not.toHaveBeenCalled();

            // Hydration complete — syncs model but doesn't trigger reanalysis
            rerender({
                modelId: 'gemini-2.5-flash',
                isModelHydrated: true,
            });

            // Still no submit because this is just hydration
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('user model change after hydration triggers reanalysis', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: CACHED_RESULT,
                lockedInfoDepth: [],
            });

            const { rerender } = renderHook(
                ({
                    modelId,
                    isModelHydrated,
                }: {
                    modelId: string;
                    isModelHydrated: boolean;
                }) =>
                    useAnalysis({
                        ...makeOptions(),
                        modelId: modelId as never,
                        isModelHydrated,
                    }),
                {
                    wrapper: makeWrapper(),
                    initialProps: {
                        modelId: 'gemini-2.5-flash-lite',
                        isModelHydrated: true,
                    },
                }
            );

            // Change model after hydration
            rerender({
                modelId: 'gemini-2.5-flash',
                isModelHydrated: true,
            });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalled();
            });
        });
    });

    describe('cooldown countdown (L444-452)', () => {
        it('starts interval when cooldownMs > 0 and counts down', async () => {
            // The fetchReanalyzeCooldownMs mock returns a positive value,
            // which activates the countdown effect.
            (getReanalyzeCooldownMs as Mock).mockResolvedValue(3000);

            vi.useFakeTimers();

            const { result } = renderHook(() => useAnalysis(makeOptions()), {
                wrapper: makeWrapper(),
            });

            // Let the async effect resolve
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });

            // Cooldown should now be 3000
            expect(result.current.reanalyzeCooldownMs).toBe(3000);

            // Advance 1 second — interval fires
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });

            expect(result.current.reanalyzeCooldownMs).toBe(2000);

            vi.useRealTimers();
        });
    });

    describe('poll loop: processing keeps polling', () => {
        it('keeps polling while status is processing and settles on done', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-processing',
            });
            mockPoll
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce({
                    status: 'done',
                    result: CACHED_RESULT,
                    lockedInfoDepth: [],
                });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisResult).toMatchObject(
                    CACHED_RESULT
                );
            });
            // The two 'processing' ticks must not have terminated the loop.
            expect(mockPoll).toHaveBeenCalledTimes(3);
            expect(result.current.isAnalyzing).toBe(false);
        });
    });

    describe('poll ceiling — stalled job beyond ANALYSIS_POLL_MAX_DURATION_MS', () => {
        it('surfaces a visible error and releases the cooldown for a forced request', async () => {
            // Mirrors the financials/options/fundamental/news/overall
            // poll-ceiling tests (congress remains on the older call-count
            // pattern — see useCongressTrendBranches.test.tsx — it was not
            // touched by this branch). Job is submitted, then repeatedly
            // polls as 'processing' (a genuinely stalled job). Date.now() is
            // keyed off an observable event — the poll mock flipping
            // `stalled` — rather than a raw Date.now() call count: counting
            // calls is brittle because any extra Date.now() from React
            // Query/React internals (or a future line earlier in the hook)
            // shifts the count and silently breaks the freeze.
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-stalled',
            });
            const frozenStart = Date.now();
            let stalled = false;
            mockPoll.mockImplementation(async () => {
                stalled = true;
                return { status: 'processing' };
            });
            const dateSpy = vi
                .spyOn(Date, 'now')
                .mockImplementation(() =>
                    stalled
                        ? frozenStart + ANALYSIS_POLL_MAX_DURATION_MS + 1
                        : frozenStart
                );

            try {
                const { result } = renderHook(
                    () => useAnalysis(makeOptions()),
                    {
                        wrapper: makeWrapper(),
                    }
                );

                act(() => {
                    result.current.handleReanalyze();
                });

                await waitFor(() => {
                    expect(result.current.analysisError).toBe(
                        ANALYSIS_POLL_TIMEOUT_MESSAGE
                    );
                });

                expect(result.current.isAnalyzing).toBe(false);
                // handleReanalyze always submits with force=true, so the
                // ceiling timeout must release the Redis cooldown the same
                // way the other error branches do — otherwise the user is
                // locked out of retrying for the full 5-minute window.
                expect(mockRelease).toHaveBeenCalled();
                expect(result.current.reanalyzeCooldownMs).toBe(0);
            } finally {
                dateSpy.mockRestore();
            }
        });
    });

    describe('forced reanalyze', () => {
        it('starts the full cooldown when a forced poll completes, tolerating a legacy response with no lock metadata', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-forced',
            });
            // `lockedInfoDepth` is intentionally absent: a rolling deploy can
            // serve this shape from an older instance, and `undefined` reaching
            // state would crash downstream `.length` consumers.
            // The cast is the point of the test: `PollAnalysisResult` declares
            // `lockedInfoDepth` as required, but a rolling deploy can serve a
            // payload without it, and TypeScript cannot stop that at runtime.
            mockPoll.mockResolvedValueOnce({
                status: 'done',
                result: CACHED_RESULT,
            } as unknown as Awaited<ReturnType<typeof pollAnalysisAction>>);

            const { result } = renderHook(() => useAnalysis(makeOptions()), {
                wrapper: makeWrapper(),
            });

            act(() => {
                result.current.handleReanalyze();
            });

            await waitFor(() => {
                expect(result.current.analysisResult).toMatchObject(
                    CACHED_RESULT
                );
            });
            expect(result.current.lockedInfoDepth).toEqual([]);
            expect(result.current.reanalyzeCooldownMs).toBeGreaterThan(0);
        });

        it('ignores a reanalyze request issued before the tier has hydrated', () => {
            const { result } = renderHook(
                () => useAnalysis({ ...makeOptions(), isTierHydrated: false }),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.handleReanalyze();
            });

            // Not even the cooldown slot is claimed — claiming it and then
            // bailing would lock the user out of a reanalyze they never got.
            expect(mockTryAcquire).not.toHaveBeenCalled();
            expect(mockSubmit).not.toHaveBeenCalled();
        });
    });

    describe('cancel failures stay silent', () => {
        it('warns instead of throwing when the unmount cancel rejects', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-unmount',
            });
            // One 'processing' tick, then a poll that never settles: `sleep` is
            // mocked to resolve immediately, so a repeating 'processing' would
            // spin the loop hot and kill the worker.
            mockPoll
                .mockResolvedValueOnce({ status: 'processing' })
                .mockImplementation(() => new Promise(() => {}));
            mockCancel.mockRejectedValue(new Error('cancel boom'));

            const { unmount } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            // Wait for the poll to actually start: that proves the submit
            // resolved to 'submitted' and the job id ref is populated, which is
            // what the unmount cleanup keys off. Waiting on `isAnalyzing` alone
            // is satisfied while the submit is still in flight, so the unmount
            // could land before there is any job to cancel.
            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            // Unmounting with a job in flight fires the fire-and-forget cancel.
            // Its rejection must be swallowed — an unhandled rejection here
            // would surface as a test-environment crash in production too.
            unmount();

            await waitFor(() => {
                expect(warnSpy).toHaveBeenCalledWith(
                    '[useAnalysis] cancel failed',
                    expect.any(Error)
                );
            });

            warnSpy.mockRestore();
        });
    });
});
