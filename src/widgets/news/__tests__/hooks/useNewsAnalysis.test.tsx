import type { MockedFunction, Mock } from 'vitest';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import {
    cancelNewsAnalysisJobAction,
    pollNewsAnalysisAction,
    submitNewsAnalysisAction,
} from '@/entities/news-article/actions';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ModelId, NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { readBlobText } from '@/shared/test-utils/readBlobText';

vi.mock('@/entities/news-article/actions', () => ({
    submitNewsAnalysisAction: vi.fn(),
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitNewsAnalysisAction as MockedFunction<
    typeof submitNewsAnalysisAction
>;
const mockPoll = pollNewsAnalysisAction as MockedFunction<
    typeof pollNewsAnalysisAction
>;
const mockCancel = cancelNewsAnalysisJobAction as MockedFunction<
    typeof cancelNewsAnalysisJobAction
>;

const NEWS_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '실적 기대가 최근 뉴스 흐름을 주도하고 있습니다.',
    keyEventsKo: ['신제품 수요 기대'],
    upcomingEventsKo: ['분기 실적 발표'],
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
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

function Probe() {
    useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite');
    return null;
}

describe('useNewsAnalysis', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: NEWS_RESULT,
        });
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    it('서버 렌더 중 Server Action을 호출하지 않는다', () => {
        const Wrapper = makeWrapper();

        renderToString(
            <Wrapper>
                <Probe />
            </Wrapper>
        );

        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('클라이언트 마운트 후 Server Action을 호출한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            'gemini-2.5-flash-lite'
        );
    });

    it('모든 status variant에서 trigger 함수를 노출한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        // loading 상태 — trigger is a function
        expect(typeof result.current.trigger).toBe('function');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        // done 상태 — trigger is still a function
        expect(typeof result.current.trigger).toBe('function');
    });

    it('분석 실패 후 retry가 Server Action을 다시 호출한다', async () => {
        mockSubmit
            .mockRejectedValueOnce(new Error('temporary failure'))
            .mockResolvedValueOnce({
                status: 'cached',
                result: NEWS_RESULT,
            });
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        const state = result.current;
        if (state.status !== 'error') {
            throw new Error('expected error state');
        }

        act(() => {
            state.retry();
        });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledTimes(2);
    });

    describe('뉴스 갱신 연동', () => {
        it('invalidateQueries 호출 시 재분석이 실행되고 새 결과를 반환한다', async () => {
            const updatedResult: NewsAnalysisResponse = {
                ...NEWS_RESULT,
                currentDriverKo: '업데이트된 분석 결과입니다.',
            };
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: NEWS_RESULT,
                })
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: updatedResult,
                });

            const wrapper = makeWrapper();
            const client = queryClients[queryClients.length - 1];

            const { result } = renderHook(
                () =>
                    useNewsAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        'gemini-2.5-flash-lite'
                    ),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            act(() => {
                void client.invalidateQueries({
                    queryKey: QUERY_KEYS.newsAnalysisPrefix('AAPL'),
                });
            });

            await waitFor(() => {
                expect(result.current.status).toBe('done');
                if (result.current.status !== 'done') return;
                expect(result.current.result.currentDriverKo).toBe(
                    '업데이트된 분석 결과입니다.'
                );
            });
            expect(mockSubmit).toHaveBeenCalledTimes(2);
        });

        it('refetch 중 isFetching이 true이면 loading 상태를 반환한다', async () => {
            // 두 번째 submit을 보류 상태로 두어 loading 중간 상태를 관찰한다
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: NEWS_RESULT,
                })
                .mockImplementationOnce(() => new Promise(() => {}));

            const wrapper = makeWrapper();
            const client = queryClients[queryClients.length - 1];

            const { result, unmount } = renderHook(
                () =>
                    useNewsAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        'gemini-2.5-flash-lite'
                    ),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            act(() => {
                void client.invalidateQueries({
                    queryKey: QUERY_KEYS.newsAnalysisPrefix('AAPL'),
                });
            });

            await waitFor(() => {
                expect(result.current.status).toBe('loading');
            });

            unmount();
        });

        it('invalidateQueries 없이 cached 데이터가 있으면 재분석을 실행하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: NEWS_RESULT,
            });

            const wrapper = makeWrapper();

            const { result, rerender } = renderHook(
                () =>
                    useNewsAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        'gemini-2.5-flash-lite'
                    ),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            rerender();

            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });

    describe('cancel', () => {
        it('polling 중 unmount 시 진행 중인 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-news-123',
            });
            // never resolves → 루프가 첫 poll 호출 직후 멈춰 OOM을 방지한다
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { unmount } = renderHook(
                () =>
                    useNewsAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        'gemini-2.5-flash-lite'
                    ),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancel).toHaveBeenCalledWith('job-news-123');
        });

        it('modelId 변경 시 이전 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-news-123',
            });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { rerender } = renderHook(
                ({ modelId }: { modelId: ModelId }) =>
                    useNewsAnalysis('AAPL', 'Apple Inc.', modelId),
                {
                    wrapper: makeWrapper(),
                    initialProps: { modelId: 'gemini-2.5-flash-lite' },
                }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            rerender({ modelId: 'gemini-2.5-flash' });

            expect(mockCancel).toHaveBeenCalledWith('job-news-123');
        });

        it('cached 응답 시 cancel을 호출하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: NEWS_RESULT,
            });

            const { unmount } = renderHook(
                () =>
                    useNewsAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        'gemini-2.5-flash-lite'
                    ),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancel).not.toHaveBeenCalled();
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

            it('polling 중 pagehide 발화 시 sendBeacon으로 cancel을 전송한다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'submitted',
                    jobId: 'job-news-123',
                });
                mockPoll.mockImplementation(() => new Promise(() => {}));

                renderHook(
                    () =>
                        useNewsAnalysis(
                            'AAPL',
                            'Apple Inc.',
                            'gemini-2.5-flash-lite'
                        ),
                    { wrapper: makeWrapper() }
                );

                await waitFor(() => {
                    expect(mockPoll).toHaveBeenCalled();
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
                    jobs: [{ jobId: 'job-news-123', type: 'news' }],
                });
            });

            it('job 없을 때 pagehide 발화해도 sendBeacon을 호출하지 않는다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'cached',
                    result: NEWS_RESULT,
                });

                renderHook(
                    () =>
                        useNewsAnalysis(
                            'AAPL',
                            'Apple Inc.',
                            'gemini-2.5-flash-lite'
                        ),
                    { wrapper: makeWrapper() }
                );

                await waitFor(() => {
                    expect(mockSubmit).toHaveBeenCalled();
                });

                window.dispatchEvent(new Event('pagehide'));

                expect(sendBeaconMock).not.toHaveBeenCalled();
            });

            it('pagehide 발화 후 unmount 시 이중 cancel이 발생하지 않는다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'submitted',
                    jobId: 'job-news-123',
                });
                mockPoll.mockImplementation(() => new Promise(() => {}));

                const { unmount } = renderHook(
                    () =>
                        useNewsAnalysis(
                            'AAPL',
                            'Apple Inc.',
                            'gemini-2.5-flash-lite'
                        ),
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
    });
});
