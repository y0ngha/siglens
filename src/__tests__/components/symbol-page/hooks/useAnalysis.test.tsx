/**
 * @jest-environment jsdom
 */
import { useAnalysis } from '@/components/symbol-page/hooks/useAnalysis';
import { cancelAnalysisJobAction } from '@/infrastructure/market/cancelAnalysisJobAction';
import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import { getReanalyzeCooldownMs } from '@/infrastructure/market/reanalyzeCooldown';
import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { CANCEL_JOBS_API_PATH } from '@/lib/cancelJobsApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { readBlobText } from '@/__tests__/utils/readBlobText';

jest.mock('@/infrastructure/market/submitAnalysisAction', () => ({
    submitAnalysisAction: jest.fn(),
}));

jest.mock('@/infrastructure/market/pollAnalysisAction', () => ({
    pollAnalysisAction: jest.fn(),
}));

jest.mock('@/infrastructure/market/cancelAnalysisJobAction', () => ({
    cancelAnalysisJobAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/infrastructure/market/reanalyzeCooldown', () => ({
    getReanalyzeCooldownMs: jest.fn().mockResolvedValue(0),
    releaseReanalyzeCooldown: jest.fn().mockResolvedValue(undefined),
    tryAcquireReanalyzeCooldown: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitAnalysisAction as jest.MockedFunction<
    typeof submitAnalysisAction
>;
const mockPoll = pollAnalysisAction as jest.MockedFunction<
    typeof pollAnalysisAction
>;
const mockCancel = cancelAnalysisJobAction as jest.MockedFunction<
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
    };
}

describe('useAnalysis', () => {
    let sendBeaconMock: jest.Mock;

    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        (getReanalyzeCooldownMs as jest.Mock).mockResolvedValue(0);

        sendBeaconMock = jest.fn();
        Object.defineProperty(navigator, 'sendBeacon', {
            value: sendBeaconMock,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
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

            // pagehide가 ref를 null로 만든다
            window.dispatchEvent(new Event('pagehide'));
            expect(sendBeaconMock).toHaveBeenCalledTimes(1);

            // unmount 시 ref가 null이므로 cancelAnalysisJobAction은 호출되지 않는다
            unmount();

            expect(mockCancel).not.toHaveBeenCalled();
        });
    });
});
