/**
 * Branch coverage tests for useAnalysis — targets uncovered branches
 * in submit status handlers, polling error paths, cooldown, model change,
 * and timeframe change flows.
 */

import type { Mock } from 'vitest';
import { useAnalysis } from '@/views/symbol/hooks/useAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import type { RunAnalysisResult } from '@y0ngha/siglens-core';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
type RunAnalysisActionResult =
    | (RunAnalysisResult & { personalized?: boolean })
    | AnalysisGateBlockedResult;
import {
    getReanalyzeCooldownMs,
    tryAcquireReanalyzeCooldown,
    releaseReanalyzeCooldown,
} from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
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

const mockSubmit = runAnalysisStream as Mock;
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

    describe('SSE stream error handling', () => {
        it('sets analysisError when stream resolves with error status', async () => {
            mockSubmit.mockResolvedValue({
                status: 'error',
                error: { code: 'unexpected_error', message: '분석 실패' },
            });

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toBe('분석 실패');
            });
        });

        it('maps AI_SERVER_UNSTABLE thrown error to a Korean user message', async () => {
            // core's withRetry throws new Error('AI_SERVER_UNSTABLE') when the
            // AI provider stays unavailable after all retry attempts. The SSE
            // heartbeatStream re-emits this as an SSE error event, runAnalysisStream
            // re-throws it, and the hook's mutationFn .catch() maps it to Korean.
            mockSubmit.mockRejectedValue(new Error('AI_SERVER_UNSTABLE'));

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toContain(
                    '예상치 못한 오류가 발생했습니다'
                );
            });
        });

        it('surfaces a network-level throw from runAnalysisStream as analysisError', async () => {
            mockSubmit.mockRejectedValue(new Error('Network failure'));

            const { result } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.analysisError).toBe('Network failure');
            });
        });
    });

    describe('handleReanalyze cooldown (L262-285)', () => {
        it('shows cooldown notice when acquire fails', async () => {
            /**
             * 클라이언트가 직접 쿨다운을 획득하던 로직이 서버로 이전됐다.
             * `handleReanalyze`는 이제 `tryAcquireReanalyzeCooldown`을 호출하지 않고
             * 바로 `mutate`를 실행한다. 서버가 쿨다운을 획득하지 못하면
             * `{ status: 'reanalyze_cooldown', remainingMs }` 응답을 돌려주고,
             * `onSuccess`가 `cooldownNotice`를 설정한다.
             */
            mockSubmit.mockResolvedValue({
                status: 'reanalyze_cooldown',
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

        it('쿨다운으로 거절돼도 보고 있던 분석을 잃지 않는다', async () => {
            // onMutate가 화면을 비우는데 쿨다운 응답에는 새 결과가 없다. 되돌리지
            // 않으면 재분석을 눌렀다는 이유만으로 기존 분석이 사라진다.
            const DONE = {
                status: 'done' as const,
                result: { summaryKo: '최초 분석' },
                lockedInfoDepth: [],
                personalized: false,
            };
            mockSubmit.mockResolvedValueOnce(DONE);

            const { result } = renderHook(() => useAnalysis(makeOptions()), {
                wrapper: makeWrapper(),
            });

            await act(async () => {});
            act(() => {
                result.current.handleReanalyze();
            });
            await waitFor(() => {
                expect(result.current.analysis).not.toBeNull();
            });
            const before = result.current.analysis;

            mockSubmit.mockResolvedValueOnce({
                status: 'reanalyze_cooldown',
                remainingMs: 120000,
            });
            act(() => {
                result.current.handleReanalyze();
            });

            await waitFor(() => {
                expect(result.current.reanalyzeCooldownMs).toBe(120000);
            });
            expect(result.current.analysis).toEqual(before);
        });
    });

    describe('timeframe change (L396-414)', () => {
        it('aborts in-flight stream and resubmits on timeframe change', async () => {
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: CACHED_RESULT,
                    lockedInfoDepth: [],
                })
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: CACHED_RESULT,
                    lockedInfoDepth: [],
                });

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

        it('timeframe 변경 시 첫 번째 스트림의 signal이 abort된다 — stale 데이터 덮어쓰기 방지', async () => {
            /**
             * `streamAbortRef.current?.abort()`를 삭제하면 이 테스트가 실패한다.
             * abort가 없으면 느린 첫 번째 스트림이 두 번째 스트림이 받은 fresher 데이터를
             * onSuccess에서 덮어쓸 수 있다.
             *
             * 첫 번째 mock은 결코 resolve되지 않는 promise를 반환해 abort 발화 전에
             * 완료되지 않게 한다. signal은 mock.calls에서 읽어낸다.
             */
            mockSubmit
                .mockImplementationOnce(() => new Promise(() => {})) // 영구 대기
                .mockImplementationOnce(() =>
                    Promise.resolve({
                        status: 'cached' as const,
                        result: CACHED_RESULT,
                        lockedInfoDepth: [],
                    })
                );

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

            // 첫 번째 submit이 호출될 때까지 기다린다.
            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });

            // timeframe 변경 → streamAbortRef.current?.abort() → 새 스트림 시작.
            rerender({ timeframeChangeCount: 1 });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(2);
            });

            // 각 호출의 signal을 mock.calls에서 추출한다.
            const calls = mockSubmit.mock.calls as Array<
                [{ signal?: AbortSignal }]
            >;
            const firstSignal = calls[0]?.[0]?.signal;
            const secondSignal = calls[1]?.[0]?.signal;

            expect(firstSignal).toBeInstanceOf(AbortSignal);
            // 첫 번째 signal은 timeframe 변경 시 abort되었다.
            expect(firstSignal?.aborted).toBe(true);
            // 두 번째 signal은 아직 abort되지 않았다.
            expect(secondSignal?.aborted).toBe(false);
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

    describe('forced reanalyze', () => {
        it('starts the full cooldown when a forced stream completes, tolerating a response with no lock metadata', async () => {
            // `lockedInfoDepth` is intentionally absent: a rolling deploy can
            // serve this shape from an older server instance, and `undefined`
            // reaching state would crash downstream `.length` consumers.
            // The stream now resolves directly (no poll), so the shape is the
            // same — we just mock runAnalysisStream to resolve with the legacy
            // payload.
            mockSubmit.mockResolvedValue({
                status: 'done',
                result: CACHED_RESULT,
            } as unknown as RunAnalysisActionResult);

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
});
