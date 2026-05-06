/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { useNewsAnalysis } from '@/components/news/hooks/useNewsAnalysis';

jest.mock('@/infrastructure/market/submitNewsAnalysisAction', () => ({
    submitNewsAnalysisAction: jest.fn(),
}));

jest.mock('@/infrastructure/market/pollNewsAnalysisAction', () => ({
    pollNewsAnalysisAction: jest.fn(),
}));

const mockSubmitNewsAnalysisAction =
    submitNewsAnalysisAction as jest.MockedFunction<
        typeof submitNewsAnalysisAction
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
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
    };
}

function Probe() {
    useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite');
    return null;
}

describe('useNewsAnalysis', () => {
    beforeEach(() => {
        mockSubmitNewsAnalysisAction.mockReset();
        mockSubmitNewsAnalysisAction.mockResolvedValue({
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

        expect(mockSubmitNewsAnalysisAction).not.toHaveBeenCalled();
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
        expect(mockSubmitNewsAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            'gemini-2.5-flash-lite'
        );
    });

    it('분석 실패 후 retry가 Server Action을 다시 호출한다', async () => {
        mockSubmitNewsAnalysisAction
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
        expect(mockSubmitNewsAnalysisAction).toHaveBeenCalledTimes(2);
    });
});
