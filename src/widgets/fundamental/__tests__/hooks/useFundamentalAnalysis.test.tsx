/**
 * @jest-environment jsdom
 */
import { useFundamentalAnalysis } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';
import {
    cancelFundamentalAnalysisJobAction,
    pollFundamentalAnalysisAction,
    submitFundamentalAnalysisAction,
} from '@/entities/analysis/actions';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { readBlobText } from '@/shared/test-utils/readBlobText';

jest.mock('@/entities/analysis/actions', () => ({
    submitFundamentalAnalysisAction: jest.fn(),
    pollFundamentalAnalysisAction: jest.fn(),
    cancelFundamentalAnalysisJobAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/shared/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitFundamentalAnalysisAction as jest.MockedFunction<
    typeof submitFundamentalAnalysisAction
>;
const mockPoll = pollFundamentalAnalysisAction as jest.MockedFunction<
    typeof pollFundamentalAnalysisAction
>;
const mockCancel = cancelFundamentalAnalysisJobAction as jest.MockedFunction<
    typeof cancelFundamentalAnalysisJobAction
>;

const FUNDAMENTAL_RESULT: FundamentalAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: 'AAPL 펀더멘털이 양호합니다.',
    categoryAssessments: [],
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
    useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite');
    return null;
}

describe('useFundamentalAnalysis', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: FUNDAMENTAL_RESULT,
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
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledWith(
            'AAPL',
            'gemini-2.5-flash-lite'
        );
    });

    it('분석 실패 후 retry가 Server Action을 다시 호출한다', async () => {
        mockSubmit
            .mockRejectedValueOnce(new Error('temporary failure'))
            .mockResolvedValueOnce({
                status: 'cached',
                result: FUNDAMENTAL_RESULT,
            });
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
                jobId: 'job-fundamental-123',
            });
            // never resolves → 루프가 첫 poll 호출 직후 멈춰 OOM을 방지한다
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { unmount } = renderHook(
                () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancel).toHaveBeenCalledWith('job-fundamental-123');
        });

        it('modelId 변경 시 이전 job을 cancel한다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'submitted',
                jobId: 'job-fundamental-123',
            });
            mockPoll.mockImplementation(() => new Promise(() => {}));

            const { rerender } = renderHook(
                ({ modelId }: { modelId: string }) =>
                    useFundamentalAnalysis('AAPL', modelId as never),
                {
                    wrapper: makeWrapper(),
                    initialProps: { modelId: 'gemini-2.5-flash-lite' },
                }
            );

            await waitFor(() => {
                expect(mockPoll).toHaveBeenCalled();
            });

            rerender({ modelId: 'gemini-2.5-flash' });

            expect(mockCancel).toHaveBeenCalledWith('job-fundamental-123');
        });

        it('cached 응답 시 cancel을 호출하지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: FUNDAMENTAL_RESULT,
            });

            const { unmount } = renderHook(
                () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper: makeWrapper() }
            );

            await waitFor(() => {
                expect(mockSubmit).toHaveBeenCalled();
            });

            unmount();

            expect(mockCancel).not.toHaveBeenCalled();
        });

        describe('pagehide', () => {
            let sendBeaconMock: jest.Mock;

            beforeEach(() => {
                sendBeaconMock = jest.fn();
                Object.defineProperty(navigator, 'sendBeacon', {
                    value: sendBeaconMock,
                    configurable: true,
                    writable: true,
                });
            });

            it('polling 중 pagehide 발화 시 sendBeacon으로 cancel을 전송한다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'submitted',
                    jobId: 'job-fundamental-123',
                });
                mockPoll.mockImplementation(() => new Promise(() => {}));

                renderHook(
                    () =>
                        useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
                        { jobId: 'job-fundamental-123', type: 'fundamental' },
                    ],
                });
            });

            it('job 없을 때 pagehide 발화해도 sendBeacon을 호출하지 않는다', async () => {
                mockSubmit.mockResolvedValue({
                    status: 'cached',
                    result: FUNDAMENTAL_RESULT,
                });

                renderHook(
                    () =>
                        useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
                    jobId: 'job-fundamental-123',
                });
                mockPoll.mockImplementation(() => new Promise(() => {}));

                const { unmount } = renderHook(
                    () =>
                        useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
