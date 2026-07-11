import type { MockedFunction, Mock } from 'vitest';
/**
 * pending_dependencies 상태에서 submitOverallAnalysisAction을 반복 호출하지 않고
 * 각 axis jobId를 직접 polling한 뒤 완료 후 한 번만 재submit하는지 검증한다.
 */
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import {
    cancelAnalysisJobAction,
    cancelFundamentalAnalysisJobAction,
    cancelOverallAnalysisJobAction,
    pollAnalysisAction,
    pollFundamentalAnalysisAction,
    pollOverallAnalysisAction,
    submitOverallAnalysisAction,
} from '@/entities/analysis/actions';
import {
    cancelNewsAnalysisJobAction,
    pollNewsAnalysisAction,
} from '@/entities/news-article/actions';
import {
    cancelOptionsAnalysisJobAction,
    pollOptionsAnalysisAction,
} from '@/entities/options-chain/actions';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { readBlobText } from '@/shared/test-utils/readBlobText';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

vi.mock('@/entities/analysis/actions', () => ({
    submitOverallAnalysisAction: vi.fn(),
    pollOverallAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    pollFundamentalAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/news-article/actions', () => ({
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitOverallAnalysisAction as MockedFunction<
    typeof submitOverallAnalysisAction
>;
const mockPollOverall = pollOverallAnalysisAction as MockedFunction<
    typeof pollOverallAnalysisAction
>;
const mockPollTechnical = pollAnalysisAction as MockedFunction<
    typeof pollAnalysisAction
>;
const mockPollFundamental = pollFundamentalAnalysisAction as MockedFunction<
    typeof pollFundamentalAnalysisAction
>;
const mockPollNews = pollNewsAnalysisAction as MockedFunction<
    typeof pollNewsAnalysisAction
>;
const mockCancelTechnical = cancelAnalysisJobAction as MockedFunction<
    typeof cancelAnalysisJobAction
>;
const mockCancelFundamental =
    cancelFundamentalAnalysisJobAction as MockedFunction<
        typeof cancelFundamentalAnalysisJobAction
    >;
const mockCancelNews = cancelNewsAnalysisJobAction as MockedFunction<
    typeof cancelNewsAnalysisJobAction
>;
const mockCancelOverall = cancelOverallAnalysisJobAction as MockedFunction<
    typeof cancelOverallAnalysisJobAction
>;
const mockPollOptions = pollOptionsAnalysisAction as MockedFunction<
    typeof pollOptionsAnalysisAction
>;
const mockCancelOptions = cancelOptionsAnalysisJobAction as MockedFunction<
    typeof cancelOptionsAnalysisJobAction
>;

const OVERALL_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 종합 분석',
    technicalBulletsKo: [],
    fundamentalBulletsKo: [],
    newsBulletsKo: [],
    optionsBulletsKo: [],
    financialsBulletsKo: [],
    integratedConclusionKo: '중립',
    scenarios: [],
    riskFactorsKo: [],
};

const PENDING_DEPS = {
    status: 'pending_dependencies' as const,
    pendingJobs: {
        technical: 'job-t' as string | undefined,
        fundamental: 'job-f' as string | undefined,
        news: 'job-n' as string | undefined,
        options: 'job-o' as string | undefined,
    },
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    // client를 추적해 afterEach에서 clear한다 — describe 간 query 캐시 누수 방지.
    const { wrapper, client } = createQueryClientWrapper();
    queryClients.push(client);
    return wrapper;
}

function hookArgs() {
    return ['AAPL', 'Apple Inc.', '1Day', 'gemini-2.5-flash-lite'] as const;
}

describe('useOverallAnalysis', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPollOverall.mockReset();
        mockPollTechnical.mockReset();
        mockPollFundamental.mockReset();
        mockPollNews.mockReset();
        mockPollOptions.mockReset();
        mockCancelTechnical.mockReset();
        mockCancelFundamental.mockReset();
        mockCancelNews.mockReset();
        mockCancelOverall.mockReset();
        mockCancelOptions.mockReset();
        mockCancelTechnical.mockResolvedValue(undefined);
        mockCancelFundamental.mockResolvedValue(undefined);
        mockCancelNews.mockResolvedValue(undefined);
        mockCancelOverall.mockResolvedValue(undefined);
        mockCancelOptions.mockResolvedValue(undefined);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    describe('idle', () => {
        it('trigger 전에는 idle 상태이고 Server Action을 호출하지 않는다', () => {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );
            expect(result.current.state.status).toBe('idle');
            expect(mockSubmit).not.toHaveBeenCalled();
        });
    });

    describe('SSR seed (initialResult)', () => {
        it('initialResult가 주어지면 마운트 즉시 done 상태이고 그 결과를 노출한다', () => {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs(), OVERALL_RESULT),
                { wrapper: makeWrapper() }
            );

            expect(result.current.state.status).toBe('done');
            const state = result.current.state;
            if (state.status !== 'done') throw new Error('expected done');
            expect(state.result).toEqual(OVERALL_RESULT);
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('initialResult가 없으면 idle 상태를 유지한다', () => {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            expect(result.current.state.status).toBe('idle');
        });
    });

    describe('cached', () => {
        it('submit이 cached를 반환하면 즉시 done 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });

            const state = result.current.state;
            if (state.status !== 'done') throw new Error('expected done');
            expect(state.result).toEqual(OVERALL_RESULT);
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });

    describe('submitted → polling → done', () => {
        it('submitted 후 polling을 거쳐 done이 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'overall-job',
            });
            mockPollOverall
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValueOnce({
                    status: 'done',
                    result: OVERALL_RESULT,
                });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });
            expect(mockPollOverall).toHaveBeenCalledWith('overall-job');
            expect(mockPollOverall).toHaveBeenCalledTimes(2);
        });
    });

    describe('pending_dependencies → direct polling → done', () => {
        it('submit은 총 2번만 호출되고 각 axis jobId로 직접 polling한다', async () => {
            mockSubmit
                .mockResolvedValueOnce(PENDING_DEPS)
                .mockResolvedValueOnce({
                    status: 'submitted',
                    jobId: 'overall-job',
                });
            mockPollTechnical.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollFundamental.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollNews.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOptions.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOverall.mockResolvedValue({
                status: 'done',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });

            // submit은 최초 1번 + dependency 완료 후 재submit 1번 = 총 2번만 호출
            expect(mockSubmit).toHaveBeenCalledTimes(2);
            expect(mockPollTechnical).toHaveBeenCalledWith('job-t');
            expect(mockPollFundamental).toHaveBeenCalledWith('job-f');
            expect(mockPollNews).toHaveBeenCalledWith('job-n');
            expect(mockPollOptions).toHaveBeenCalledWith('job-o');
        });

        it('processing 응답이 오면 polling을 반복하다가 done이 되면 재submit한다', async () => {
            mockSubmit
                .mockResolvedValueOnce(PENDING_DEPS)
                .mockResolvedValueOnce({
                    status: 'submitted',
                    jobId: 'overall-job',
                });
            // 2 round만에 완료
            mockPollTechnical
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValue({ status: 'done', result: {} as never });
            mockPollFundamental
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValue({ status: 'done', result: {} as never });
            mockPollNews
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValue({ status: 'done', result: {} as never });
            mockPollOptions
                .mockResolvedValueOnce({ status: 'processing' })
                .mockResolvedValue({ status: 'done', result: {} as never });
            mockPollOverall.mockResolvedValue({
                status: 'done',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });
            expect(mockSubmit).toHaveBeenCalledTimes(2);
            expect(mockPollTechnical).toHaveBeenCalledTimes(2);
        });

        it('일부 axis만 pending일 때 해당 axis의 jobId만 polling한다', async () => {
            // technical만 pending, 나머지 3개 axis는 완료된 상태
            const partialPending = {
                status: 'pending_dependencies' as const,
                pendingJobs: {
                    technical: 'job-t' as string | undefined,
                    fundamental: undefined,
                    news: undefined,
                    options: undefined,
                },
            };
            mockSubmit
                .mockResolvedValueOnce(partialPending)
                .mockResolvedValueOnce({
                    status: 'submitted',
                    jobId: 'overall-job',
                });
            mockPollTechnical.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOverall.mockResolvedValue({
                status: 'done',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });

            expect(mockPollTechnical).toHaveBeenCalledWith('job-t');
            expect(mockPollFundamental).not.toHaveBeenCalled();
            expect(mockPollNews).not.toHaveBeenCalled();
            expect(mockPollOptions).not.toHaveBeenCalled();
        });
    });

    describe('options axis (4축)', () => {
        it('options jobId가 있으면 pollOptionsAnalysisAction으로 polling한다', async () => {
            mockSubmit
                .mockResolvedValueOnce(PENDING_DEPS)
                .mockResolvedValueOnce({
                    status: 'submitted',
                    jobId: 'overall-job',
                });
            mockPollTechnical.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollFundamental.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollNews.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOptions.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOverall.mockResolvedValue({
                status: 'done',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });

            expect(mockPollOptions).toHaveBeenCalledWith('job-o');
        });

        it('pending_dependencies 중 unmount 시 options jobId로 cancel을 호출한다', async () => {
            mockSubmit.mockResolvedValue(PENDING_DEPS);
            mockPollTechnical.mockImplementation(() => new Promise(() => {}));
            mockPollFundamental.mockImplementation(() => new Promise(() => {}));
            mockPollNews.mockImplementation(() => new Promise(() => {}));
            mockPollOptions.mockImplementation(() => new Promise(() => {}));

            const { result, unmount } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(mockPollOptions).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancelOptions).toHaveBeenCalledWith('job-o');
        });

        it('done 상태에서 trigger를 다시 호출하면 force=true를 action에 전달한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                const lastCall =
                    mockSubmit.mock.calls[mockSubmit.mock.calls.length - 1];
                expect(lastCall?.[4]).toEqual({
                    force: true,
                    reasoning: false,
                });
            });
        });

        it('첫 trigger에는 force=false를 전달한다 (재분석이 아님)', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            // 첫 trigger는 queryFnForceRef(false)를 그대로 options로 넘기므로
            // 5번째 인자는 정확히 { force: false, reasoning: false }다(기본
            // reasoning=false). done 상태 재분석만 force:true.
            const firstCall = mockSubmit.mock.calls[0];
            expect(firstCall?.[4]).toEqual({
                force: false,
                reasoning: false,
            });
        });
    });

    describe('error handling', () => {
        it('dependency polling 중 error가 오면 error 상태가 된다', async () => {
            mockSubmit.mockResolvedValue(PENDING_DEPS);
            mockPollTechnical.mockResolvedValue({
                status: 'error',
                error: 'technical 분석 실패',
            });
            mockPollFundamental.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollNews.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOptions.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toBe('technical 분석 실패');
        });

        it('submit이 error를 반환하면 error 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'error',
                axis: 'technical' as const,
                error: 'submit 실패',
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toBe('submit 실패');
            expect(state.axis).toBe('technical');
        });

        it('limit_error를 반환하면 한도 초과 메시지로 error 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'limit_error',
                code: 'usage_limit_exceeded',
                error: {} as never,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toContain('한도');
        });

        it('overall polling 중 error가 오면 error 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'overall-job',
            });
            mockPollOverall.mockResolvedValue({
                status: 'error',
                error: 'overall 분석 실패',
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });
        });
    });

    describe('submit retry depth guard', () => {
        it('pending_dependencies가 반복되면 MAX_SUBMIT_RETRY_DEPTH에서 error로 멈춘다', async () => {
            // submit이 매번 pending_dependencies를 반환하고, 모든 axis poll이 즉시
            // done이라 재submit이 계속 일어난다 → depth >= 3에서 안전망이 발동.
            mockSubmit.mockResolvedValue(PENDING_DEPS);
            mockPollTechnical.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollFundamental.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollNews.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });
            mockPollOptions.mockResolvedValue({
                status: 'done',
                result: {} as never,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toContain('반복적으로 지연');
        });
    });

    describe('retry', () => {
        it('error 후 trigger를 재호출하면 분석을 재시도한다', async () => {
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'error',
                    axis: 'technical' as const,
                    error: '분석 실패',
                })
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: OVERALL_RESULT,
                });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('error')
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            expect(mockSubmit).toHaveBeenCalledTimes(2);
        });
    });

    describe('cancel', () => {
        it('overall polling 중 unmount 시 overall jobId로 cancel을 호출한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'overall-job-123',
            });
            // never resolves → 루프가 첫 poll 호출 직후 멈춰 OOM을 방지한다
            mockPollOverall.mockImplementation(() => new Promise(() => {}));

            const { result, unmount } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(mockPollOverall).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancelOverall).toHaveBeenCalledWith('overall-job-123');
            expect(mockCancelTechnical).not.toHaveBeenCalled();
            expect(mockCancelFundamental).not.toHaveBeenCalled();
            expect(mockCancelNews).not.toHaveBeenCalled();
            expect(mockCancelOptions).not.toHaveBeenCalled();
        });

        it('pending_dependencies 중 unmount 시 각 axis jobId로 cancel을 호출한다', async () => {
            mockSubmit.mockResolvedValue(PENDING_DEPS);
            mockPollTechnical.mockImplementation(() => new Promise(() => {}));
            mockPollFundamental.mockImplementation(() => new Promise(() => {}));
            mockPollNews.mockImplementation(() => new Promise(() => {}));
            mockPollOptions.mockImplementation(() => new Promise(() => {}));

            const { result, unmount } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(mockPollTechnical).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancelTechnical).toHaveBeenCalledWith('job-t');
            expect(mockCancelFundamental).toHaveBeenCalledWith('job-f');
            expect(mockCancelNews).toHaveBeenCalledWith('job-n');
            expect(mockCancelOptions).toHaveBeenCalledWith('job-o');
            expect(mockCancelOverall).not.toHaveBeenCalled();
        });

        it('dependencies phase cancel이 reject되면 각 axis마다 console.warn으로 로깅한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            try {
                mockSubmit.mockResolvedValue(PENDING_DEPS);
                mockPollTechnical.mockImplementation(
                    () => new Promise(() => {})
                );
                mockPollFundamental.mockImplementation(
                    () => new Promise(() => {})
                );
                mockPollNews.mockImplementation(() => new Promise(() => {}));
                mockPollOptions.mockImplementation(() => new Promise(() => {}));
                mockCancelTechnical.mockRejectedValue(new Error('t fail'));
                mockCancelFundamental.mockRejectedValue(new Error('f fail'));
                mockCancelNews.mockRejectedValue(new Error('n fail'));
                mockCancelOptions.mockRejectedValue(new Error('o fail'));

                const { result, unmount } = renderHook(
                    () => useOverallAnalysis(...hookArgs()),
                    { wrapper: makeWrapper() }
                );

                act(() => {
                    result.current.trigger();
                });

                await waitFor(() => {
                    expect(mockPollTechnical).toHaveBeenCalled();
                });

                unmount();

                // 4개 cancel rejection이 각각 .catch에서 console.warn으로 처리된다.
                await waitFor(() => {
                    expect(warnSpy).toHaveBeenCalledTimes(4);
                });
                const warnedMessages = warnSpy.mock.calls.map(c => c[0]);
                expect(warnedMessages).toEqual(
                    expect.arrayContaining([
                        '[useOverallAnalysis] cancel technical failed',
                        '[useOverallAnalysis] cancel fundamental failed',
                        '[useOverallAnalysis] cancel news failed',
                        '[useOverallAnalysis] cancel options failed',
                    ])
                );
            } finally {
                warnSpy.mockRestore();
            }
        });

        it('overall phase cancel이 reject되면 console.warn으로 로깅한다', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            try {
                mockSubmit.mockResolvedValue({
                    status: 'submitted',
                    jobId: 'overall-job-123',
                });
                mockPollOverall.mockImplementation(() => new Promise(() => {}));
                mockCancelOverall.mockRejectedValue(new Error('overall fail'));

                const { result, unmount } = renderHook(
                    () => useOverallAnalysis(...hookArgs()),
                    { wrapper: makeWrapper() }
                );

                act(() => {
                    result.current.trigger();
                });

                await waitFor(() => {
                    expect(mockPollOverall).toHaveBeenCalled();
                });

                unmount();

                await waitFor(() => {
                    expect(warnSpy).toHaveBeenCalledWith(
                        '[useOverallAnalysis] cancel overall failed',
                        expect.any(Error)
                    );
                });
            } finally {
                warnSpy.mockRestore();
            }
        });

        it('timeframe 변경(queryKey 교체) 시 진행 중인 overall job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'overall-job-123',
            });
            mockPollOverall.mockImplementation(() => new Promise(() => {}));

            const { result, rerender } = renderHook(
                ({ timeframe }: { timeframe: string }) =>
                    useOverallAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        timeframe as never,
                        'gemini-2.5-flash-lite'
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { timeframe: '1Day' },
                }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(mockPollOverall).toHaveBeenCalled();
            });

            rerender({ timeframe: '1Week' });

            expect(mockCancelOverall).toHaveBeenCalledWith('overall-job-123');
        });

        it('cached 응답 시 unmount해도 cancel을 호출하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result, unmount } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });

            unmount();

            expect(mockCancelOverall).not.toHaveBeenCalled();
            expect(mockCancelTechnical).not.toHaveBeenCalled();
            expect(mockCancelFundamental).not.toHaveBeenCalled();
            expect(mockCancelNews).not.toHaveBeenCalled();
            expect(mockCancelOptions).not.toHaveBeenCalled();
        });

        describe('pagehide', () => {
            let sendBeaconMock: Mock;

            beforeEach(() => {
                sendBeaconMock = vi.fn();
                Object.defineProperty(navigator, 'sendBeacon', {
                    value: sendBeaconMock,
                    configurable: true,
                    writable: true,
                });
            });

            it('overall polling 중 pagehide 발화 시 sendBeacon으로 overall job cancel을 전송한다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'submitted',
                    jobId: 'overall-job-123',
                });
                mockPollOverall.mockImplementation(() => new Promise(() => {}));

                const { result } = renderHook(
                    () => useOverallAnalysis(...hookArgs()),
                    { wrapper: makeWrapper() }
                );

                act(() => {
                    result.current.trigger();
                });

                await waitFor(() => {
                    expect(mockPollOverall).toHaveBeenCalled();
                });

                window.dispatchEvent(new Event('pagehide'));

                expect(sendBeaconMock).toHaveBeenCalledTimes(1);
                const [url, blob] = sendBeaconMock.mock.calls[0] as [
                    string,
                    Blob,
                ];
                expect(url).toBe(CANCEL_JOBS_API_PATH);
                expect(blob.type).toBe('application/json');

                const text = await readBlobText(blob);
                expect(JSON.parse(text)).toEqual({
                    jobs: [{ jobId: 'overall-job-123', type: 'overall' }],
                });
            });

            it('pending_dependencies 중 pagehide 발화 시 각 axis job cancel을 sendBeacon으로 전송한다', async () => {
                mockSubmit.mockResolvedValue(PENDING_DEPS);
                mockPollTechnical.mockImplementation(
                    () => new Promise(() => {})
                );
                mockPollFundamental.mockImplementation(
                    () => new Promise(() => {})
                );
                mockPollNews.mockImplementation(() => new Promise(() => {}));
                mockPollOptions.mockImplementation(() => new Promise(() => {}));

                const { result } = renderHook(
                    () => useOverallAnalysis(...hookArgs()),
                    { wrapper: makeWrapper() }
                );

                act(() => {
                    result.current.trigger();
                });

                await waitFor(() => {
                    expect(mockPollTechnical).toHaveBeenCalled();
                });

                window.dispatchEvent(new Event('pagehide'));

                expect(sendBeaconMock).toHaveBeenCalledTimes(1);
                const [url, blob] = sendBeaconMock.mock.calls[0] as [
                    string,
                    Blob,
                ];
                expect(url).toBe(CANCEL_JOBS_API_PATH);
                expect(blob.type).toBe('application/json');

                const text = await readBlobText(blob);
                const body = JSON.parse(text) as {
                    jobs: { jobId: string; type: string }[];
                };
                expect(body.jobs).toEqual(
                    expect.arrayContaining([
                        { jobId: 'job-t', type: 'analysis' },
                        { jobId: 'job-f', type: 'fundamental' },
                        { jobId: 'job-n', type: 'news' },
                        { jobId: 'job-o', type: 'options' },
                    ])
                );
                expect(body.jobs).toHaveLength(4);
            });

            it('일부 axis만 pending일 때 pagehide는 pending axis의 cancel만 전송한다', async () => {
                // technical, news만 pending. fundamental/options는 undefined라
                // getPageHideJobs 삼항의 "false" 가지를 탄다.
                const partialPending = {
                    status: 'pending_dependencies' as const,
                    pendingJobs: {
                        technical: 'job-t' as string | undefined,
                        fundamental: undefined,
                        news: 'job-n' as string | undefined,
                        options: undefined,
                    },
                };
                mockSubmit.mockResolvedValue(partialPending);
                mockPollTechnical.mockImplementation(
                    () => new Promise(() => {})
                );
                mockPollNews.mockImplementation(() => new Promise(() => {}));

                const { result } = renderHook(
                    () => useOverallAnalysis(...hookArgs()),
                    { wrapper: makeWrapper() }
                );

                act(() => {
                    result.current.trigger();
                });

                await waitFor(() => {
                    expect(mockPollTechnical).toHaveBeenCalled();
                });

                window.dispatchEvent(new Event('pagehide'));

                expect(sendBeaconMock).toHaveBeenCalledTimes(1);
                const [, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
                const text = await readBlobText(blob);
                const body = JSON.parse(text) as {
                    jobs: { jobId: string; type: string }[];
                };
                expect(body.jobs).toEqual(
                    expect.arrayContaining([
                        { jobId: 'job-t', type: 'analysis' },
                        { jobId: 'job-n', type: 'news' },
                    ])
                );
                expect(body.jobs).toHaveLength(2);
            });

            it('job 없을 때 pagehide 발화해도 sendBeacon을 호출하지 않는다', async () => {
                const { result } = renderHook(
                    () => useOverallAnalysis(...hookArgs()),
                    { wrapper: makeWrapper() }
                );

                // trigger 없이 idle 상태에서 pagehide 발화
                expect(result.current.state.status).toBe('idle');
                window.dispatchEvent(new Event('pagehide'));

                expect(sendBeaconMock).not.toHaveBeenCalled();
            });
        });
    });
});

/**
 * F1: crypto assetClass — fundamental/options 축은 submit·poll·cancel 하지 않는다.
 * pending_dependencies 응답에 fundamental/options job이 있더라도 crypto는 무시한다.
 */
describe('useOverallAnalysis — crypto assetClass (F1)', () => {
    const CRYPTO_PENDING_DEPS = {
        status: 'pending_dependencies' as const,
        pendingJobs: {
            technical: 'job-t' as string | undefined,
            // Server might include these for crypto; client must ignore them.
            fundamental: 'job-f' as string | undefined,
            news: 'job-n' as string | undefined,
            options: 'job-o' as string | undefined,
        },
    };

    const SUBMITTED = {
        status: 'submitted' as const,
        jobId: 'overall-job',
    };

    beforeEach(() => {
        mockSubmit.mockReset();
        mockPollOverall.mockReset();
        mockPollTechnical.mockReset();
        mockPollFundamental.mockReset();
        mockPollNews.mockReset();
        mockPollOptions.mockReset();
        mockCancelTechnical.mockResolvedValue(undefined);
        mockCancelFundamental.mockResolvedValue(undefined);
        mockCancelNews.mockResolvedValue(undefined);
        mockCancelOverall.mockResolvedValue(undefined);
        mockCancelOptions.mockResolvedValue(undefined);
    });

    afterEach(() => {
        queryClients.forEach(c => c.clear());
        queryClients.length = 0;
    });

    it('pending_dependencies 응답에 fundamental/options가 있어도 폴링하지 않는다', async () => {
        // First call: pending_dependencies with all 4 axes
        // Second call: submitted (after deps resolve)
        mockSubmit
            .mockResolvedValueOnce(CRYPTO_PENDING_DEPS)
            .mockResolvedValueOnce(SUBMITTED);

        // crypto only polls technical + news; these resolve immediately
        mockPollTechnical.mockResolvedValue({
            status: 'done',
            result: {} as never,
        });
        mockPollNews.mockResolvedValue({ status: 'done', result: {} as never });
        mockPollOverall.mockResolvedValue({
            status: 'done',
            result: OVERALL_RESULT,
        });

        const { result } = renderHook(
            () =>
                useOverallAnalysis(
                    'BTCUSD',
                    'Bitcoin USD',
                    '1Day',
                    'gemini-2.5-flash-lite',
                    undefined,
                    'crypto'
                ),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => expect(result.current.state.status).toBe('done'));

        // fundamental and options must NEVER be polled for crypto
        expect(mockPollFundamental).not.toHaveBeenCalled();
        expect(mockPollOptions).not.toHaveBeenCalled();

        // technical and news must be polled with their respective jobIds
        expect(mockPollTechnical).toHaveBeenCalledWith('job-t');
        expect(mockPollNews).toHaveBeenCalledWith('job-n');
    });

    it('cleanup 시 fundamental/options cancel을 호출하지 않는다', async () => {
        mockSubmit.mockResolvedValue(CRYPTO_PENDING_DEPS);
        // Hold the dependency polls unresolved so the hook stays parked in the
        // dependencies phase at unmount (technical + news still in-flight).
        // Returning { status: 'processing' } here would be fatal: sleep() is
        // mocked to resolve instantly (see module mock above), so a poll that
        // keeps resolving turns waitForDependencies into a delay-free microtask
        // loop that re-renders every iteration → unbounded heap growth → OOM.
        // A never-resolving promise suspends the loop at its await instead,
        // mirroring the real "still in-flight" state — same pattern the equity
        // dependencies-phase cancel tests use above.
        mockPollTechnical.mockImplementation(() => new Promise(() => {}));
        mockPollNews.mockImplementation(() => new Promise(() => {}));

        const { result, unmount } = renderHook(
            () =>
                useOverallAnalysis(
                    'BTCUSD',
                    'Bitcoin USD',
                    '1Day',
                    'gemini-2.5-flash-lite',
                    undefined,
                    'crypto'
                ),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.trigger();
        });

        await waitFor(() =>
            expect(result.current.state.status).toBe('pending_dependencies')
        );

        unmount();

        // crypto cleanup must cancel technical and news with their respective jobIds
        expect(mockCancelTechnical).toHaveBeenCalledWith('job-t');
        expect(mockCancelNews).toHaveBeenCalledWith('job-n');

        // crypto cleanup must not cancel fundamental or options
        expect(mockCancelFundamental).not.toHaveBeenCalled();
        expect(mockCancelOptions).not.toHaveBeenCalled();
    });
});
