// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useTickerSearch } from '@/features/ticker-search/hooks/useTickerSearch';
import type { TickerSearchResult } from '@/shared/lib/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

const mockResults: TickerSearchResult[] = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    },
];

let lastQueryKey: readonly string[] = [];
let lastNetworkMode: string | undefined;
/** 훅이 파생하는 `isSearching`을 검사하려면 쿼리 상태를 케이스마다 바꿀 수 있어야 한다. */
const queryState = { status: 'success' as 'success' | 'pending' | 'error' };

vi.mock('@tanstack/react-query', () => ({
    useQuery: ({
        queryKey,
        enabled,
        networkMode,
    }: {
        queryKey: readonly string[];
        enabled: boolean;
        networkMode?: string;
    }) => {
        lastQueryKey = queryKey;
        lastNetworkMode = networkMode;
        return {
            data: enabled ? mockResults : undefined,
            isError: queryState.status === 'error',
            error: null,
            status: enabled ? queryState.status : 'pending',
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
        lastNetworkMode = undefined;
        queryState.status = 'success';
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

    it('재시도 대기 중(pending)에도 검색 중으로 본다', () => {
        // `isFetching`으로 판단하면 재시도 백오프 구간이 false라 "결과 없음"이
        // 한 번 번쩍인다. `status`는 첫 결착까지 pending을 유지한다.
        queryState.status = 'pending';
        const { result } = renderHook(() => useTickerSearch('AAPL'));
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.isSearching).toBe(true);
    });

    it('질의가 없으면 pending이어도 검색 중이 아니다', () => {
        // 비활성 쿼리는 영원히 pending이다. 이걸 거르지 않으면 빈 입력 화면에
        // 스피너가 상주한다.
        queryState.status = 'pending';
        const { result } = renderHook(() => useTickerSearch(''));
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.isSearching).toBe(false);
    });

    it("실패가 pause로 끝나지 않도록 networkMode를 'always'로 건다", () => {
        // 기본값 'online'에서는 실패한 조회가 fetchStatus 'paused'로 멈춰 status가
        // pending에 머문다 — 실증으로 확인했다. 그러면 isError가 영원히 false라
        // 실패 UI도 reportClientError도 실행되지 않는다.
        renderHook(() => useTickerSearch('AAPL'));
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(lastNetworkMode).toBe('always');
    });
});
