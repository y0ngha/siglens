/**
 * @jest-environment jsdom
 */
import { useFundamentalAnalysis } from '@/components/fundamental/hooks/useFundamentalAnalysis';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

jest.mock('@/infrastructure/market/submitFundamentalAnalysisAction', () => ({
    submitFundamentalAnalysisAction: jest.fn(),
}));

jest.mock('@/infrastructure/market/pollFundamentalAnalysisAction', () => ({
    pollFundamentalAnalysisAction: jest.fn(),
}));

const mockSubmitFundamentalAnalysisAction =
    submitFundamentalAnalysisAction as jest.MockedFunction<
        typeof submitFundamentalAnalysisAction
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
        mockSubmitFundamentalAnalysisAction.mockReset();
        mockSubmitFundamentalAnalysisAction.mockResolvedValue({
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

        expect(mockSubmitFundamentalAnalysisAction).not.toHaveBeenCalled();
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
        expect(mockSubmitFundamentalAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'gemini-2.5-flash-lite'
        );
    });

    it('분석 실패 후 retry가 Server Action을 다시 호출한다', async () => {
        mockSubmitFundamentalAnalysisAction
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
        expect(mockSubmitFundamentalAnalysisAction).toHaveBeenCalledTimes(2);
    });
});
