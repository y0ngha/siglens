// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useTickerSearch } from '@/features/ticker-search/hooks/useTickerSearch';
import type { TickerSearchResult } from '@/shared/lib/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

const mockResults: TickerSearchResult[] = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    },
];

let lastQueryKey: readonly string[] = [];

vi.mock('@tanstack/react-query', () => ({
    useQuery: ({
        queryKey,
        enabled,
    }: {
        queryKey: readonly string[];
        enabled: boolean;
    }) => {
        lastQueryKey = queryKey;
        return {
            data: enabled ? mockResults : undefined,
            isFetching: false,
        };
    },
}));

vi.mock('@/entities/ticker/actions', () => ({
    searchTickerAction: vi.fn(),
}));

describe('useTickerSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        lastQueryKey = [];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns empty results and isSearching: false for an empty query', () => {
        const { result } = renderHook(() => useTickerSearch(''));

        expect(result.current.results).toEqual([]);
        expect(result.current.isSearching).toBe(false);
        expect(result.current.hasQuery).toBe(false);
    });

    it('debounces the query before passing it to useQuery', () => {
        const { result } = renderHook(() => useTickerSearch('A'));

        // Before debounce fires, debouncedQuery is still empty
        expect(result.current.hasQuery).toBe(false);

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.hasQuery).toBe(true);
    });

    it('returns results after debounce completes for a valid query', () => {
        const { result } = renderHook(() => useTickerSearch('AAPL'));

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.results).toEqual(mockResults);
        expect(result.current.hasQuery).toBe(true);
    });

    it('immediately clears debouncedQuery when query becomes empty', () => {
        const { result, rerender } = renderHook(
            ({ query }) => useTickerSearch(query),
            { initialProps: { query: 'AAPL' } }
        );

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.hasQuery).toBe(true);

        rerender({ query: '' });

        // Short queries clear the debounce immediately (0ms timeout)
        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(result.current.hasQuery).toBe(false);
    });

    it('constructs query key with debounced query value', () => {
        renderHook(() => useTickerSearch('MSFT'));

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(lastQueryKey).toEqual(QUERY_KEYS.tickerSearch('MSFT'));
    });
});
