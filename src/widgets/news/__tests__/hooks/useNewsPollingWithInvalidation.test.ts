// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNewsPollingWithInvalidation } from '@/widgets/news/hooks/useNewsPollingWithInvalidation';
import type { NewsDisplayItem } from '@/shared/lib/types';

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
