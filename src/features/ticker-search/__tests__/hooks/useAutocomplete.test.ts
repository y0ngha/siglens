// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useAutocomplete } from '@/features/ticker-search/hooks/useAutocomplete';

const mockPush = vi.fn();
const mockPrefetch = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: vi.fn(),
        prefetch: mockPrefetch,
    }),
}));

vi.mock('@/shared/hooks/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn(),
}));

/**
 * 조회 상태를 케이스마다 갈아끼운다. 친 문자열 직행은 "결과가 없음을 **확인**했을
 * 때"만 허용되므로, 그 확인 여부(디바운스 반영·진행 중·실패)를 흔들어 봐야 한다.
 */
const searchState = {
    isSearching: false,
    isError: false,
    /** null이면 "입력과 같음"(정상 반영). 값을 주면 한 박자 전 질의를 흉내낸다. */
    staleDebouncedQuery: null as string | null,
    /** 검색 키의 목적지는 결과 유무로 갈린다 — 비우면 "친 문자열" 경로를 밟는다. */
    hasResults: true,
};

vi.mock('@/features/ticker-search/hooks/useTickerSearch', () => ({
    useTickerSearch: (query: string) => ({
        results:
            query && searchState.hasResults
                ? [
                      {
                          symbol: 'AAPL',
                          name: 'Apple Inc.',
                          koreanName: '애플',
                      },
                      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
                  ]
                : [],
        isSearching: searchState.isSearching,
        isError: searchState.isError,
        debouncedQuery: searchState.staleDebouncedQuery ?? query,
        hasQuery: query.length >= 1,
    }),
}));

function createChangeEvent(value: string): ChangeEvent<HTMLInputElement> {
    return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

function createKeyEvent(
    key: string,
    extra: Partial<KeyboardEvent<HTMLInputElement>> = {}
): KeyboardEvent<HTMLInputElement> {
    return {
        key,
        preventDefault: vi.fn(),
        ...extra,
    } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe('useAutocomplete', () => {
    beforeEach(() => {
        searchState.isSearching = false;
        searchState.isError = false;
        searchState.staleDebouncedQuery = null;
        searchState.hasResults = true;
        vi.clearAllMocks();
    });

    it('returns initial state with empty query and closed dropdown', () => {
        const { result } = renderHook(() => useAutocomplete());

        expect(result.current.query).toBe('');
        expect(result.current.results).toEqual([]);
        expect(result.current.isSearching).toBe(false);
        expect(result.current.selectedIndex).toBe(-1);
        expect(result.current.isOpen).toBe(false);
    });

    it('updates query on handleChange', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('AP'));
        });

        expect(result.current.query).toBe('AP');
        expect(result.current.isOpen).toBe(true);
    });

    it('opens dropdown when query has content', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        expect(result.current.isOpen).toBe(true);
    });

    it('moves selectedIndex down on ArrowDown', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowDown'));
        });

        expect(result.current.selectedIndex).toBe(0);
    });

    it('moves selectedIndex up on ArrowUp', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowDown'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowDown'));
        });

        expect(result.current.selectedIndex).toBe(1);

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowUp'));
        });

        expect(result.current.selectedIndex).toBe(0);
    });

    it('does not go below -1 on ArrowUp', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowUp'));
        });

        expect(result.current.selectedIndex).toBe(-1);
    });

    it('does not exceed results length on ArrowDown', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        // Press ArrowDown 5 times (more than 2 results), each in its own act
        for (let i = 0; i < 5; i++) {
            act(() => {
                result.current.handleKeyDown(createKeyEvent('ArrowDown'));
            });
        }

        expect(result.current.selectedIndex).toBe(1); // capped at results.length - 1
    });

    it('navigates to selected result on Enter', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowDown'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).toHaveBeenCalledWith('/AAPL');
    });

    it('passes the selected result display name to onSelect on Enter', () => {
        // 최근 검색이 `AAPL`이 아니라 `애플`로 남으려면 Enter 경로도 라벨을
        // 실어 보내야 한다 — 클릭 경로만 고치면 키보드 사용자만 티커를 본다.
        const onSelect = vi.fn();
        const { result } = renderHook(() => useAutocomplete({ onSelect }));

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowDown'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(onSelect).toHaveBeenCalledWith({
            symbol: 'AAPL',
            label: '애플',
        });
    });

    it('결과가 없으면 친 문자열(대문자)로 이동한다', () => {
        // FMP가 색인하지 않는 종목에 닿는 유일한 경로.
        searchState.hasResults = false;
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('msft'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).toHaveBeenCalledWith('/MSFT');
    });

    it('결과가 있으면 첫 결과로 이동한다', () => {
        // 엔진이 아는 게 있으면 그 판단을 따른다 — `appl`을 치고 Enter를 눌렀을 때
        // `/APPL`(404)이 아니라 AAPL로 가야 한다.
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('appl'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).toHaveBeenCalledWith('/AAPL');
    });

    it('closes dropdown on Escape', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        expect(result.current.isOpen).toBe(true);

        act(() => {
            result.current.handleKeyDown(createKeyEvent('Escape'));
        });

        expect(result.current.isOpen).toBe(false);
    });

    it('calls onSelect callback when navigating', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() => useAutocomplete({ onSelect }));

        act(() => {
            result.current.navigate('AAPL');
        });

        expect(onSelect).toHaveBeenCalledWith({
            symbol: 'AAPL',
            label: 'AAPL',
        });
        expect(mockPush).toHaveBeenCalledWith('/AAPL');
    });

    it('does not call router.push when navigateOnSelect is false (still calls onSelect)', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useAutocomplete({ onSelect, navigateOnSelect: false })
        );

        act(() => {
            result.current.navigate('AAPL');
        });

        expect(onSelect).toHaveBeenCalledWith({
            symbol: 'AAPL',
            label: 'AAPL',
        });
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('resets state after navigate', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        act(() => {
            result.current.navigate('AAPL');
        });

        expect(result.current.query).toBe('');
        expect(result.current.isOpen).toBe(false);
        expect(result.current.selectedIndex).toBe(-1);
    });

    it('handleSearchClick navigates to trimmed uppercase query', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent(' aapl '));
        });

        act(() => {
            result.current.handleSearchClick();
        });

        expect(mockPush).toHaveBeenCalledWith('/AAPL');
    });

    it('handleSearchClick does nothing when query is empty', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleSearchClick();
        });

        expect(mockPush).not.toHaveBeenCalled();
    });

    it('handleFocus opens dropdown', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        // Close it first
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Escape'));
        });

        expect(result.current.isOpen).toBe(false);

        act(() => {
            result.current.handleFocus();
        });

        expect(result.current.isOpen).toBe(true);
    });

    it('prefetch caches the symbol to avoid duplicate prefetches', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.prefetch('AAPL');
        });

        expect(mockPrefetch).toHaveBeenCalledTimes(1);
        expect(mockPrefetch).toHaveBeenCalledWith('/AAPL');

        act(() => {
            result.current.prefetch('AAPL');
        });

        // Should not call again for same symbol
        expect(mockPrefetch).toHaveBeenCalledTimes(1);
    });

    it('resets selectedIndex on handleChange', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('A'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('ArrowDown'));
        });

        expect(result.current.selectedIndex).toBe(0);

        act(() => {
            result.current.handleChange(createChangeEvent('AP'));
        });

        expect(result.current.selectedIndex).toBe(-1);
    });

    it('결과도 없고 티커 형태도 아니면 아무 데도 가지 않는다', () => {
        // 친 문자열이 그대로 URL이 된다. `삼성전자`는 없는 페이지로 가고,
        // `../`가 섞인 입력은 엉뚱한 라우트로 간다. 오버레이와 같은 가드다.
        searchState.hasResults = false;
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('삼성전자'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).not.toHaveBeenCalled();
    });

    it('조회가 안 끝났으면 그 자리에서 이동하지 않는다', () => {
        // 이때의 결과는 "없다"가 아니라 "아직 모른다"다. 구분하지 않으면 `apple`을
        // 치고 곧바로 Enter를 누른 사용자가 AAPL이 아니라 `/APPLE`(404)로 간다.
        // 의도는 남아 있다가 결착된 뒤 처리된다(위 두 케이스).
        searchState.hasResults = false;
        searchState.staleDebouncedQuery = '';
        searchState.isSearching = true;
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('apple'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).not.toHaveBeenCalled();
    });

    it('조회에 실패했으면 친 문자열로 이동하지 않는다', () => {
        searchState.hasResults = false;
        searchState.isError = true;
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('msft'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).not.toHaveBeenCalled();
    });

    it('폼 모드(navigateOnSelect: false)는 친 문자열을 그대로 확정한다', () => {
        // 보유종목 추가 폼은 이동이 아니라 값 확정이다. 형태 검사·결과 우선 규칙을
        // 걸면 FMP가 모르는 심볼을 넣는 문서화된 degrade 경로가 막히고, 이상한
        // 입력은 서버 검증 오류 대신 **아무 일도 안 일어나는** 화면이 된다.
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useAutocomplete({ navigateOnSelect: false, onSelect })
        );

        act(() => {
            result.current.handleChange(createChangeEvent('aa pl'));
        });
        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(onSelect).toHaveBeenCalledWith({
            symbol: 'AA PL',
            label: 'AA PL',
        });
        expect(mockPush).not.toHaveBeenCalled();
    });
});
