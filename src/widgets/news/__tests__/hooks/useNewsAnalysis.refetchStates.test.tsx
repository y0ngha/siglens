/**
 * 실패한 백그라운드 재조회가 화면의 결과를 지우지 않는지(N1), 오류 뒤 재시도가 로딩으로 보이는지(N2)
 * 고정한다 — 둘 다 React Query가 `isError`를 유지한 채 재조회하는 상태에서 갈린다.
 */
import type { Mock } from 'vitest';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

const mockStream = runAnalysisStream as Mock;

const NEWS_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '실적 기대가 최근 뉴스 흐름을 주도하고 있습니다.',
    keyEventsKo: ['신제품 수요 기대'],
    upcomingEventsKo: ['분기 실적 발표'],
};

const LIMIT_ERROR = {
    status: 'error',
    code: 'usage_limit_exceeded',
    error: { message: 'limit' },
};

function setup() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
            <IntlTestProvider>{children}</IntlTestProvider>
        </QueryClientProvider>
    );
    const hook = renderHook(
        () => useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-3.5-flash-lite'),
        { wrapper }
    );
    return { client, ...hook };
}

describe('useNewsAnalysis — 재조회 상태', () => {
    beforeEach(() => {
        mockStream.mockReset();
    });

    it('[N1] 백그라운드 재조회가 실패해도 화면의 결과를 done으로 유지한다', async () => {
        mockStream.mockResolvedValueOnce({
            status: 'cached',
            result: NEWS_RESULT,
        });
        const { client, result } = setup();
        await waitFor(() => expect(result.current.status).toBe('done'));

        mockStream.mockResolvedValueOnce(LIMIT_ERROR);
        await act(async () => {
            await client.invalidateQueries({
                queryKey: QUERY_KEYS.newsAnalysisPrefix('AAPL'),
            });
        });

        // React Query의 알림은 한 틱 늦게 렌더에 닿는다 — 실패 상태가 반영될 시간을 준다.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(mockStream).toHaveBeenCalledTimes(2);
        // 전제: 재조회가 실제로 실패했고, 그래도 쿼리에는 이전 데이터가 남아 있다.
        expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error');
        if (result.current.status !== 'done') throw new Error('expected done');
        expect(result.current.result).toEqual(NEWS_RESULT);
        client.clear();
    });

    it('[N2] 오류 뒤 재시도하는 동안은 오류가 아니라 loading이다', async () => {
        mockStream.mockResolvedValueOnce(LIMIT_ERROR);
        const { client, result } = setup();
        await waitFor(() => expect(result.current.status).toBe('error'));

        let release: (v: unknown) => void = () => {};
        mockStream.mockImplementationOnce(
            () => new Promise(resolve => (release = resolve))
        );
        act(() => {
            if (result.current.status === 'error') result.current.retry();
        });

        await waitFor(() => expect(result.current.status).toBe('loading'));
        await act(async () => {
            release({ status: 'cached', result: NEWS_RESULT });
        });
        await waitFor(() => expect(result.current.status).toBe('done'));
        client.clear();
    });

    it('[N2] 재조회 실패로 오류가 남은 쿼리를 다시 부르는 동안에도 loading이다', async () => {
        // 이전 데이터가 있으면 React Query는 재조회가 시작돼도 직전 `isError`를 유지한다.
        mockStream.mockResolvedValueOnce({
            status: 'cached',
            result: NEWS_RESULT,
        });
        const { client, result } = setup();
        await waitFor(() => expect(result.current.status).toBe('done'));
        mockStream.mockResolvedValueOnce(LIMIT_ERROR);
        await act(async () => {
            await client.invalidateQueries({
                queryKey: QUERY_KEYS.newsAnalysisPrefix('AAPL'),
            });
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        let release: (v: unknown) => void = () => {};
        mockStream.mockImplementationOnce(
            () => new Promise(resolve => (release = resolve))
        );
        act(() => result.current.trigger());

        await waitFor(() => expect(result.current.status).toBe('loading'));
        await act(async () => {
            release({ status: 'cached', result: NEWS_RESULT });
        });
        await waitFor(() => expect(result.current.status).toBe('done'));
        client.clear();
    });
});
