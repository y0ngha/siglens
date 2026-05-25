import { vi, type MockedFunction, type Mock } from 'vitest';
import { useAnalysis } from '@/widgets/symbol-page/hooks/useAnalysis';
import {
    cancelAnalysisJobAction,
    pollAnalysisAction,
    submitAnalysisAction,
} from '@/entities/analysis/actions';
import { getReanalyzeCooldownMs } from '@/entities/analysis';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { readBlobText } from '@/shared/test-utils/readBlobText';

vi.mock('@/entities/analysis/actions', () => ({
    submitAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/entities/analysis', () => ({
    getReanalyzeCooldownMs: vi.fn().mockResolvedValue(0),
    releaseReanalyzeCooldown: vi.fn().mockResolvedValue(undefined),
    tryAcquireReanalyzeCooldown: vi.fn().mockResolvedValue({ ok: true }),
}));

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

            window.dispatchEvent(new Event('pagehide'));
            expect(sendBeaconMock).toHaveBeenCalledTimes(1);

            unmount();

            expect(mockCancel).not.toHaveBeenCalled();
        });
    });
});
