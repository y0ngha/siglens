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

vi.mock('@/features/ticker-search/hooks/useTickerSearch', () => ({
    useTickerSearch: (query: string) => ({
        results: query
            ? [
                  { symbol: 'AAPL', name: 'Apple Inc.' },
                  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
              ]
            : [],
        isSearching: false,
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

    it('navigates to trimmed uppercase query on Enter without selection', () => {
        const { result } = renderHook(() => useAutocomplete());

        act(() => {
            result.current.handleChange(createChangeEvent('msft'));
        });

        act(() => {
            result.current.handleKeyDown(createKeyEvent('Enter'));
        });

        expect(mockPush).toHaveBeenCalledWith('/MSFT');
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

        expect(onSelect).toHaveBeenCalledWith('AAPL');
        expect(mockPush).toHaveBeenCalledWith('/AAPL');
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
});
