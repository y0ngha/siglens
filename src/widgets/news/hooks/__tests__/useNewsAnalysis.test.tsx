import type { Mock } from 'vitest';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;

const NEWS_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: 'Strong earnings',
    keyEventsKo: ['Earnings beat'],
    upcomingEventsKo: [],
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

describe('useNewsAnalysis — trigger coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    it('loading 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockReturnValue(new Promise(() => undefined));

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple', 'gemini-2.5-flash-lite', {
                    enabled: true,
                }),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');
        expect(typeof result.current.trigger).toBe('function');
    });

    it('done 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: NEWS_RESULT,
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple', 'gemini-2.5-flash-lite', {
                    enabled: true,
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(typeof result.current.trigger).toBe('function');
    });

    it('bot_blocked 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple', 'gemini-2.5-flash-lite', {
                    enabled: true,
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
        expect(typeof result.current.trigger).toBe('function');
    });

    it('error 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'no_news',
            error: '분석할 뉴스가 없습니다.',
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple', 'gemini-2.5-flash-lite', {
                    enabled: true,
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });
        expect(typeof result.current.trigger).toBe('function');
    });
});
