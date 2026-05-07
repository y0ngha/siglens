/**
 * @jest-environment jsdom
 *
 * pending_dependencies 상태에서 submitOverallAnalysisAction을 반복 호출하지 않고
 * 각 axis jobId를 직접 polling한 뒤 완료 후 한 번만 재submit하는지 검증한다.
 */
import { useOverallAnalysis } from '@/components/overall/hooks/useOverallAnalysis';
import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { pollOverallAnalysisAction } from '@/infrastructure/market/pollOverallAnalysisAction';
import { submitOverallAnalysisAction } from '@/infrastructure/market/submitOverallAnalysisAction';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

jest.mock('@/infrastructure/market/submitOverallAnalysisAction', () => ({
    submitOverallAnalysisAction: jest.fn(),
}));
jest.mock('@/infrastructure/market/pollOverallAnalysisAction', () => ({
    pollOverallAnalysisAction: jest.fn(),
}));
jest.mock('@/infrastructure/market/pollAnalysisAction', () => ({
    pollAnalysisAction: jest.fn(),
}));
jest.mock('@/infrastructure/market/pollFundamentalAnalysisAction', () => ({
    pollFundamentalAnalysisAction: jest.fn(),
}));
jest.mock('@/infrastructure/market/pollNewsAnalysisAction', () => ({
    pollNewsAnalysisAction: jest.fn(),
}));
jest.mock('@/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitOverallAnalysisAction as jest.MockedFunction<
    typeof submitOverallAnalysisAction
>;
const mockPollOverall = pollOverallAnalysisAction as jest.MockedFunction<
    typeof pollOverallAnalysisAction
>;
const mockPollTechnical = pollAnalysisAction as jest.MockedFunction<
    typeof pollAnalysisAction
>;
const mockPollFundamental =
    pollFundamentalAnalysisAction as jest.MockedFunction<
        typeof pollFundamentalAnalysisAction
    >;
const mockPollNews = pollNewsAnalysisAction as jest.MockedFunction<
    typeof pollNewsAnalysisAction
>;

const OVERALL_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 종합 분석',
    technicalBulletsKo: [],
    fundamentalBulletsKo: [],
    newsBulletsKo: [],
    threeAxisConclusionKo: '중립',
    scenarios: [],
    riskFactorsKo: [],
};

const PENDING_DEPS = {
    status: 'pending_dependencies' as const,
    pendingJobs: {
        technical: 'job-t' as string | undefined,
        fundamental: 'job-f' as string | undefined,
        news: 'job-n' as string | undefined,
    },
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
            // technical만 pending, fundamental/news는 완료된 상태
            const partialPending = {
                status: 'pending_dependencies' as const,
                pendingJobs: {
                    technical: 'job-t' as string | undefined,
                    fundamental: undefined,
                    news: undefined,
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
});
