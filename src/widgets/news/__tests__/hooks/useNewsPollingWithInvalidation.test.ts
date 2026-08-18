// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNewsPollingWithInvalidation } from '@/widgets/news/hooks/useNewsPollingWithInvalidation';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

const mockUseNewsCardPolling = vi.fn();

vi.mock('@/widgets/news/hooks/useNewsCardPolling', () => ({
    useNewsCardPolling: (
        symbol: string,
        items: NewsDisplayItem[],
        onComplete: (items: NewsDisplayItem[]) => void
    ) => mockUseNewsCardPolling(symbol, items, onComplete),
}));

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        client,
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
    };
}

const ENRICHED_ITEM = {
    id: '1',
    title: 'News 1',
    url: 'https://example.com/1',
    publishedAt: '2025-01-01T00:00:00Z',
    source: 'Test',
    symbol: 'AAPL',
    sentiment: 'bullish',
    priceImpact: 'high',
} as unknown as NewsDisplayItem;

const PENDING_ITEM = {
    id: '2',
    title: 'News 2',
    url: 'https://example.com/2',
    publishedAt: '2025-01-01T00:00:00Z',
    source: 'Test',
    symbol: 'AAPL',
    sentiment: null,
    priceImpact: null,
} as unknown as NewsDisplayItem;

describe('useNewsPollingWithInvalidation', () => {
    afterEach(() => {
        mockUseNewsCardPolling.mockReset();
    });

    /**
     * [회귀] 이 훅의 존재 이유는 "폴링이 끝났을 때 보강 수가 마운트 시점보다 늘었으면
     * 그 종목의 newsAnalysis 쿼리를 무효화한다" 하나뿐인데, 기존 두 케이스는
     * `expect.any(Function)`으로 위임만 확인하고 그 콜백을 **한 번도 호출하지 않는다**.
     * 훅 본문을 통째로 no-op으로 만들어도 108건이 통과했다(감사: 테스트 라운드 18).
     */
    it('보강이 늘어난 채로 폴링이 끝나면 newsAnalysis 쿼리를 무효화한다', () => {
        mockUseNewsCardPolling.mockReturnValue({
            items: [PENDING_ITEM],
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [PENDING_ITEM]),
            { wrapper }
        );

        const onComplete = mockUseNewsCardPolling.mock.calls[0]![2] as (
            items: NewsDisplayItem[]
        ) => void;
        act(() => onComplete([ENRICHED_ITEM, PENDING_ITEM]));

        expect(invalidate).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.newsAnalysisPrefix('AAPL'),
        });
        client.clear();
    });

    it('보강 수가 그대로면 무효화하지 않는다 — 무의미한 재조회 방지', () => {
        mockUseNewsCardPolling.mockReturnValue({
            items: [ENRICHED_ITEM],
            isPolling: false,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [ENRICHED_ITEM]),
            { wrapper }
        );

        const onComplete = mockUseNewsCardPolling.mock.calls[0]![2] as (
            items: NewsDisplayItem[]
        ) => void;
        act(() => onComplete([ENRICHED_ITEM]));

        expect(invalidate).not.toHaveBeenCalled();
        client.clear();
    });

    it('delegates to useNewsCardPolling and returns its result', () => {
        const pollingReturn = { items: [ENRICHED_ITEM], isPolling: false };
        mockUseNewsCardPolling.mockReturnValue(pollingReturn);

        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [ENRICHED_ITEM]),
            { wrapper }
        );

        expect(result.current).toBe(pollingReturn);
        expect(mockUseNewsCardPolling).toHaveBeenCalledWith(
            'AAPL',
            [ENRICHED_ITEM],
            expect.any(Function)
        );
        client.clear();
    });

    it('passes initial items to useNewsCardPolling', () => {
        mockUseNewsCardPolling.mockReturnValue({
            items: [PENDING_ITEM],
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [PENDING_ITEM]),
            { wrapper }
        );

        expect(mockUseNewsCardPolling).toHaveBeenCalledWith(
            'AAPL',
            [PENDING_ITEM],
            expect.any(Function)
        );
        client.clear();
    });
});
