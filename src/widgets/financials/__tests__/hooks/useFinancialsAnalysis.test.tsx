import type { MockedFunction, Mock } from 'vitest';
import { useFinancialsAnalysis } from '@/widgets/financials/hooks/useFinancialsAnalysis';
import {
    cancelFinancialsAnalysisJobAction,
    pollFinancialsAnalysisAction,
    submitFinancialsAnalysisAction,
} from '@/entities/analysis/actions';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { readBlobText } from '@/shared/test-utils/readBlobText';

vi.mock('@/entities/analysis/actions', () => ({
    submitFinancialsAnalysisAction: vi.fn(),
    pollFinancialsAnalysisAction: vi.fn(),
    cancelFinancialsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitFinancialsAnalysisAction as MockedFunction<
    typeof submitFinancialsAnalysisAction
>;
const mockPoll = pollFinancialsAnalysisAction as MockedFunction<
    typeof pollFinancialsAnalysisAction
>;
const mockCancel = cancelFinancialsAnalysisJobAction as MockedFunction<
    typeof cancelFinancialsAnalysisJobAction
>;

const FINANCIALS_RESULT: FinancialsAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: 'AAPL 재무 상태가 양호합니다.',
    axisAssessments: [],
    riskFactorsKo: [],
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
    useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite');
    return null;
}

describe('useFinancialsAnalysis', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: FINANCIALS_RESULT,
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

    it('클라이언트 마운트 후 Server Action을 호출한다 (cached → done)', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledWith(
            'AAPL',
            'gemini-2.5-flash-lite',
            false
        );
    });

    it('모든 status variant에서 trigger 함수를 노출한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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

    it('submitted → poll → done 흐름', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-financials-123',
        });
        mockPoll.mockResolvedValueOnce({
            status: 'done',
            result: FINANCIALS_RESULT,
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockPoll).toHaveBeenCalledWith('job-financials-123');
    });

    it('miss_no_trigger → bot_blocked 상태', async () => {
        mockSubmit.mockResolvedValue({
            status: 'miss_no_trigger',
        } as never);

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
    });

    it('error 상태를 반환한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
            error: '데이터 로드 실패',
        } as never);

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error state');
        expect(result.current.error.message).toBe('데이터 로드 실패');
    });

    it('분석 실패 후 retry가 Server Action을 다시 호출한다', async () => {
        mockSubmit
            .mockRejectedValueOnce(new Error('temporary failure'))
            .mockResolvedValueOnce({
                status: 'cached',
                result: FINANCIALS_RESULT,
            });
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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

    describe('cancel', () => {
        it('polling 중 unmount 시 진행 중인 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-financials-123',
            });
            // never resolves → 루프가 첫 poll 호출 직후 멈춰 OOM을 방지한다
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { unmount } = renderHook(
                () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancel).toHaveBeenCalledWith('job-financials-123');
        });

        it('modelId 변경 시 이전 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-financials-123',
            });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { rerender } = renderHook(
                ({ modelId }: { modelId: string }) =>
                    useFinancialsAnalysis('AAPL', modelId as never),
                {
                    wrapper: makeWrapper(),
                    initialProps: { modelId: 'gemini-2.5-flash-lite' },
                }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            rerender({ modelId: 'gemini-2.5-flash' });

            expect(mockCancel).toHaveBeenCalledWith('job-financials-123');
        });

        it('cached 응답 시 cancel을 호출하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: FINANCIALS_RESULT,
            });

            const { unmount } = renderHook(
                () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
                    jobId: 'job-financials-123',
                });
                mockPoll.mockImplementation(() => new Promise(() => {}));

                renderHook(
                    () =>
                        useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
                    jobs: [
                        {
                            jobId: 'job-financials-123',
                            type: 'financials',
                        },
                    ],
                });
            });

            it('job 없을 때 pagehide 발화해도 sendBeacon을 호출하지 않는다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'cached',
                    result: FINANCIALS_RESULT,
                });

                renderHook(
                    () =>
                        useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
                    jobId: 'job-financials-123',
                });
                mockPoll.mockImplementation(() => new Promise(() => {}));

                const { unmount } = renderHook(
                    () =>
                        useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
