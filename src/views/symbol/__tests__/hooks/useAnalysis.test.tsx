import type { MockedFunction, Mock } from 'vitest';
import { useAnalysis } from '@/views/symbol/hooks/useAnalysis';
import {
    cancelAnalysisJobAction,
    pollAnalysisAction,
    submitAnalysisAction,
} from '@/entities/analysis/actions';
import { getReanalyzeCooldownMs } from '@/entities/analysis';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type {
    AnalysisResponse,
    Tier,
    TierInfoDepth,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { readBlobText } from '@/shared/test-utils/readBlobText';

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

const mockSubmit = submitAnalysisAction as MockedFunction<
    typeof submitAnalysisAction
>;
const mockPoll = pollAnalysisAction as MockedFunction<
    typeof pollAnalysisAction
>;
const mockCancel = cancelAnalysisJobAction as MockedFunction<
    typeof cancelAnalysisJobAction
>;

const INITIAL_ANALYSIS = {} as unknown as AnalysisResponse;

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
    reasoning?: boolean;
    isReasoningHydrated?: boolean;
    initialLockedInfoDepth?: readonly TierInfoDepth[];
    isTierHydrated?: boolean;
    tier?: Tier;
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
        reasoning: overrides?.reasoning,
        isReasoningHydrated: overrides?.isReasoningHydrated,
        initialLockedInfoDepth: overrides?.initialLockedInfoDepth,
        isTierHydrated: overrides?.isTierHydrated,
        tier: overrides?.tier,
    };
}

describe('useAnalysis', () => {
    let sendBeaconMock: Mock;

    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        (getReanalyzeCooldownMs as Mock).mockResolvedValue(0);

        sendBeaconMock = vi.fn();
        Object.defineProperty(navigator, 'sendBeacon', {
            value: sendBeaconMock,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    describe('isModelHydrated', () => {
        it('initialAnalysisFailed=true이고 isModelHydrated=false이면 mutate 전에도 isAnalyzing이 true다', () => {
            const { result } = renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isModelHydrated: false,
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            expect(result.current.isAnalyzing).toBe(true);
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('isModelHydrated가 false→true로 전환되면 자동 재분석을 실행한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            const { rerender } = renderHook(
                ({ isModelHydrated }: { isModelHydrated: boolean }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isModelHydrated,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { isModelHydrated: false },
                }
            );

            expect(mockSubmit).not.toHaveBeenCalled();

            rerender({ isModelHydrated: true });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
        });

        it('initialAnalysisFailed=false이면 isModelHydrated=false여도 isAnalyzing이 false다', () => {
            const { result } = renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: false,
                            isModelHydrated: false,
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            expect(result.current.isAnalyzing).toBe(false);
        });
    });

    describe('isTierHydrated', () => {
        it('waits for the resolved tier before retrying a free SSR analysis', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            const { result, rerender } = renderHook(
                ({ isTierHydrated }: { isTierHydrated: boolean }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            initialLockedInfoDepth: ['partial_detail'],
                            isTierHydrated,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { isTierHydrated: false },
                }
            );

            expect(result.current.lockedInfoDepth).toEqual(['partial_detail']);
            expect(mockSubmit).not.toHaveBeenCalled();

            rerender({ isTierHydrated: true });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
                expect(result.current.lockedInfoDepth).toEqual([]);
            });
        });

        it('refetches the free-safe SSR result once a member tier hydrates', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            const { rerender } = renderHook(
                ({ isTierHydrated }: { isTierHydrated: boolean }) =>
                    useAnalysis(
                        makeOptions({
                            isTierHydrated,
                            tier: 'member',
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { isTierHydrated: false },
                }
            );

            expect(mockSubmit).not.toHaveBeenCalled();

            rerender({ isTierHydrated: true });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
        });

        it('does not render a legacy cached result without lock metadata for a resolved free tier', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
            } as never);

            const { result } = renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isTierHydrated: true,
                            tier: 'free',
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.lockedInfoDepth).toEqual([
                    'partial_detail',
                    'full_detail',
                    'entry',
                    'stoploss',
                    'target',
                    'confidence',
                ]);
                expect(result.current.analysisResult).toBeNull();
            });
        });

        it('does not render a legacy poll result without lock metadata for a resolved free tier', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'legacy-job',
            });
            mockPoll.mockResolvedValue({
                status: 'done',
                result: INITIAL_ANALYSIS,
            } as never);

            const { result } = renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isTierHydrated: true,
                            tier: 'free',
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.lockedInfoDepth).toContain('full_detail');
                expect(result.current.analysisResult).toBeNull();
            });
        });

        it('sets the normalized result and a non-empty lockedInfoDepth for a free tier with a genuine partial lock', async () => {
            // Unlike the "legacy cached result" test above (empty/missing
            // lockedInfoDepth triggers the FREE_LOCKED_INFO_DEPTH fabrication
            // guard), a real gated response carries a non-empty
            // lockedInfoDepth and must flow straight through to state.
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: {
                    summary: '무료 티어 부분 공개 요약',
                    trend: 'bullish',
                    riskLevel: 'medium',
                } as unknown as AnalysisResponse,
                lockedInfoDepth: ['partial_detail'],
            });

            const { result } = renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isTierHydrated: true,
                            tier: 'free',
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(result.current.lockedInfoDepth).toEqual([
                    'partial_detail',
                ]);
                expect(result.current.analysisResult).not.toBeNull();
                expect(result.current.analysisResult?.summary).toBe(
                    '무료 티어 부분 공개 요약'
                );
                expect(result.current.analysisResult?.trend).toBe('bullish');
                expect(result.current.analysisResult?.riskLevel).toBe('medium');
            });
        });

        it('clears a member result before a free-tier refresh can complete', async () => {
            let resolveSecondSubmit: (() => void) | undefined;
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: INITIAL_ANALYSIS,
                    lockedInfoDepth: [],
                })
                .mockImplementationOnce(
                    () =>
                        new Promise(resolve => {
                            resolveSecondSubmit = () =>
                                resolve({
                                    status: 'submitted',
                                    jobId: 'free-refresh',
                                });
                        })
                );

            const { result, rerender } = renderHook(
                ({ tier }: { tier: Tier }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            initialLockedInfoDepth: ['full_detail'],
                            isTierHydrated: true,
                            tier,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { tier: 'member' as Tier },
                }
            );

            await waitFor(() => {
                expect(result.current.analysisResult).not.toBeNull();
            });

            rerender({ tier: 'free' });

            await waitFor(() => {
                expect(result.current.analysisResult).toBeNull();
                expect(result.current.lockedInfoDepth).toEqual(['full_detail']);
            });
            resolveSecondSubmit?.();
        });
    });

    describe('reasoning (member-reasoning-toggle spec Part A)', () => {
        it('forwards reasoning to submitAnalysisAction', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            reasoning: true,
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledWith(
                    'AAPL',
                    'Apple Inc.',
                    '1Day',
                    false,
                    undefined,
                    undefined,
                    true
                );
            });
        });

        it('initialAnalysisFailed=true이고 isReasoningHydrated=false이면 mutate 전에도 isAnalyzing이 true다', () => {
            const { result } = renderHook(
                () =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isReasoningHydrated: false,
                        })
                    ),
                { wrapper: makeWrapper() }
            );

            expect(result.current.isAnalyzing).toBe(true);
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('isReasoningHydrated가 false→true로 전환되면 자동 재분석을 실행한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            const { rerender } = renderHook(
                ({ isReasoningHydrated }: { isReasoningHydrated: boolean }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isReasoningHydrated,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { isReasoningHydrated: false },
                }
            );

            expect(mockSubmit).not.toHaveBeenCalled();

            rerender({ isReasoningHydrated: true });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
        });

        it('reasoning 값이 변경되면(회원 토글) 재분석을 트리거한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            const { rerender } = renderHook(
                ({ reasoning }: { reasoning: boolean }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: true,
                            isReasoningHydrated: true,
                            reasoning,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { reasoning: false },
                }
            );

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
            mockSubmit.mockClear();

            rerender({ reasoning: true });

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalledTimes(1);
            });
            expect(mockSubmit).toHaveBeenCalledWith(
                'AAPL',
                'Apple Inc.',
                '1Day',
                false,
                undefined,
                undefined,
                true
            );
        });

        it('hydration으로 인한 reasoning 값 변화(마운트 직후 false→저장된 true)는 재분석을 트리거하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            const { rerender } = renderHook(
                ({
                    reasoning,
                    isReasoningHydrated,
                }: {
                    reasoning: boolean;
                    isReasoningHydrated: boolean;
                }) =>
                    useAnalysis(
                        makeOptions({
                            initialAnalysisFailed: false,
                            reasoning,
                            isReasoningHydrated,
                        })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: {
                        reasoning: false,
                        isReasoningHydrated: false,
                    },
                }
            );

            expect(mockSubmit).not.toHaveBeenCalled();

            // Hydration flips reasoning false→true and isReasoningHydrated false→true
            // in the same render (mirrors the modelId hydration flip) — no fetch.
            rerender({ reasoning: true, isReasoningHydrated: true });

            expect(mockSubmit).not.toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        it('polling 중 unmount 시 진행 중인 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-analysis-123',
            });
            // never resolves → 루프가 첫 poll 호출 직후 멈춰 OOM을 방지한다
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { unmount } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancel).toHaveBeenCalledWith('job-analysis-123');
        });

        it('symbol 변경 시 진행 중인 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-analysis-123',
            });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { rerender } = renderHook(
                ({ symbol }: { symbol: string }) =>
                    useAnalysis(
                        makeOptions({ symbol, initialAnalysisFailed: true })
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { symbol: 'AAPL' },
                }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            rerender({ symbol: 'MSFT' });

            expect(mockCancel).toHaveBeenCalledWith('job-analysis-123');
        });

        it('polling 중 pagehide 발화 시 sendBeacon으로 cancel을 전송한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-analysis-123',
            });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            window.dispatchEvent(new Event('pagehide'));

            expect(sendBeaconMock).toHaveBeenCalledTimes(1);
            const [url, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
            expect(url).toBe(CANCEL_JOBS_API_PATH);
            expect(blob.type).toBe('application/json');

            const text = await readBlobText(blob);
            expect(JSON.parse(text)).toEqual({
                jobs: [{ jobId: 'job-analysis-123', type: 'analysis' }],
            });
        });

        it('job 없을 때 pagehide 발화해도 sendBeacon을 호출하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: INITIAL_ANALYSIS,
                lockedInfoDepth: [],
            });

            renderHook(() => useAnalysis(makeOptions()), {
                wrapper: makeWrapper(),
            });

            await waitFor(() => {
                expect(getReanalyzeCooldownMs).toHaveBeenCalled();
            });

            window.dispatchEvent(new Event('pagehide'));

            expect(sendBeaconMock).not.toHaveBeenCalled();
        });

        it('pagehide 발화 후 unmount 시 이중 cancel이 발생하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-analysis-123',
            });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { unmount } = renderHook(
                () => useAnalysis(makeOptions({ initialAnalysisFailed: true })),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            window.dispatchEvent(new Event('pagehide'));
            expect(sendBeaconMock).toHaveBeenCalledTimes(1);

            unmount();

            expect(mockCancel).not.toHaveBeenCalled();
        });
    });

    // 소스 정규화 — useAnalysis는 부분 initialAnalysis(누락된 배열/객체)를
    // normalizeAnalysisResponse로 정규화해 다운스트림(AnalysisPanel 등)에
    // 타입 계약을 보장한다.
    describe('정규화', () => {
        it('부분 initialAnalysis의 누락 배열/객체 필드를 기본값으로 채워 노출한다', () => {
            const partialInitial = {
                summary: '요약',
                trend: 'bullish',
                riskLevel: 'medium',
                // 모든 배열/객체 필드 누락
            } as unknown as AnalysisResponse;

            const { result } = renderHook(
                () =>
                    useAnalysis({
                        ...makeOptions(),
                        initialAnalysis: partialInitial,
                    }),
                { wrapper: makeWrapper() }
            );

            expect(result.current.analysis.indicatorResults).toEqual([]);
            expect(result.current.analysis.patternSummaries).toEqual([]);
            expect(result.current.analysis.strategyResults).toEqual([]);
            expect(result.current.analysis.trendlines).toEqual([]);
            expect(result.current.analysis.keyLevels).toEqual({
                support: [],
                resistance: [],
            });
            expect(result.current.analysis.priceTargets).toEqual({
                bullish: null,
                bearish: null,
            });
            // 잘 형성된 필드는 그대로 보존된다.
            expect(result.current.analysis.summary).toBe('요약');
            expect(result.current.analysis.trend).toBe('bullish');
        });
    });
});
