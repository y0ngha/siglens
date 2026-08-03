import type { Mock } from 'vitest';
import { useFinancialsAnalysis } from '@/widgets/financials/hooks/useFinancialsAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;

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
            expect.objectContaining({
                type: 'financials',
                params: expect.objectContaining({
                    symbol: 'AAPL',
                    modelId: 'gemini-2.5-flash-lite',
                    reasoning: false,
                }),
            })
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

    it('done 흐름 — 단건 run 호출로 결과를 반환한다', async () => {
        mockSubmit.mockResolvedValue({
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
        expect(mockSubmit).toHaveBeenCalledTimes(1);
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
});
