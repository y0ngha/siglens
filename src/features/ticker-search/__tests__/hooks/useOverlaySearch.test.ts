// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useOverlaySearch } from '@/features/ticker-search/hooks/useOverlaySearch';
import type { TickerSearchResult } from '@/shared/lib/types';

const APPLE: TickerSearchResult = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    koreanName: '애플',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

/** 조회 상태를 케이스마다 바꾼다. `debouncedQuery`가 입력과 다르면 한 박자 전 결과다. */
const searchState = {
    results: [] as TickerSearchResult[],
    isSearching: false,
    isError: false,
    hasQuery: true,
    debouncedQuery: null as string | null,
};
vi.mock('@/features/ticker-search/hooks/useTickerSearch', () => ({
    useTickerSearch: (query: string) => ({
        results: searchState.results,
        isSearching: searchState.isSearching,
        isError: searchState.isError,
        hasQuery: searchState.hasQuery,
        debouncedQuery: searchState.debouncedQuery ?? query,
    }),
}));

function change(value: string): ChangeEvent<HTMLInputElement> {
    return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

function enter(isComposing = false): KeyboardEvent<HTMLInputElement> {
    return {
        key: 'Enter',
        preventDefault: vi.fn(),
        nativeEvent: { isComposing, keyCode: 13 },
    } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe('useOverlaySearch', () => {
    beforeEach(() => {
        searchState.results = [APPLE];
        searchState.isSearching = false;
        searchState.isError = false;
        searchState.hasQuery = true;
        searchState.debouncedQuery = null;
    });

    function renderTyped(value: string) {
        const onSubmitTarget = vi.fn();
        const hook = renderHook(() => useOverlaySearch(onSubmitTarget));
        act(() => {
            hook.result.current.handleChange(change(value));
        });
        return { ...hook, onSubmitTarget };
    }

    it('결착된 조회에서 Enter는 첫 결과를 목적지로 넘긴다', () => {
        const { result, onSubmitTarget } = renderTyped('apple');
        act(() => {
            result.current.handleKeyDown(enter());
        });

        expect(onSubmitTarget).toHaveBeenCalledWith({
            symbol: 'AAPL',
            label: '애플',
        });
    });

    it('결과가 이전 질의의 것이면 Enter를 보류한다', () => {
        searchState.debouncedQuery = 'ap';
        const { result, onSubmitTarget } = renderTyped('apple');
        act(() => {
            result.current.handleKeyDown(enter());
        });

        expect(onSubmitTarget).not.toHaveBeenCalled();
    });

    it('보류한 Enter는 조회가 결착되면 처리된다', () => {
        searchState.debouncedQuery = 'ap';
        const { result, rerender, onSubmitTarget } = renderTyped('apple');
        act(() => {
            result.current.handleKeyDown(enter());
        });
        searchState.debouncedQuery = null;
        rerender();

        expect(onSubmitTarget).toHaveBeenCalledTimes(1);
    });

    it('보류 중 계속 타이핑하면 검색 의도를 버린다', () => {
        searchState.debouncedQuery = 'ap';
        const { result, rerender, onSubmitTarget } = renderTyped('apple');
        act(() => {
            result.current.handleKeyDown(enter());
        });
        act(() => {
            result.current.handleChange(change('apples'));
        });
        searchState.debouncedQuery = null;
        rerender();

        expect(onSubmitTarget).not.toHaveBeenCalled();
    });

    it('조회가 실패했으면 Enter로 아무 데도 가지 않는다', () => {
        searchState.isError = true;
        searchState.results = [];
        const { result, onSubmitTarget } = renderTyped('TSLA');
        act(() => {
            result.current.handleKeyDown(enter());
        });

        expect(onSubmitTarget).not.toHaveBeenCalled();
    });

    it('IME 조합 중의 Enter는 무시한다', () => {
        const { result, onSubmitTarget } = renderTyped('애플');
        act(() => {
            result.current.handleKeyDown(enter(true));
        });

        expect(onSubmitTarget).not.toHaveBeenCalled();
    });

    it('결과가 없고 한글 질의면 상태가 emptyKorean이다', () => {
        searchState.results = [];
        const { result } = renderTyped('삼성전자');

        expect(result.current.status).toBe('emptyKorean');
    });
});
