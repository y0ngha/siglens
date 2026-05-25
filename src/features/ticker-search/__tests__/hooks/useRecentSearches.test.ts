// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useRecentSearches } from '@/features/ticker-search/hooks/useRecentSearches';

const mockGetRecentSearches = vi.fn<() => string[]>(() => []);
const mockAddRecentSearch = vi.fn();
const mockRemoveRecentSearch = vi.fn();
const mockClearRecentSearches = vi.fn();

vi.mock('@/entities/ticker', () => ({
    getRecentSearches: (...args: unknown[]) =>
        mockGetRecentSearches(...(args as [])),
    addRecentSearch: (...args: unknown[]) =>
        mockAddRecentSearch(...(args as [string])),
    removeRecentSearch: (...args: unknown[]) =>
        mockRemoveRecentSearch(...(args as [string])),
    clearRecentSearches: (...args: unknown[]) =>
        mockClearRecentSearches(...(args as [])),
    RECENT_SEARCHES_STORAGE_KEY: 'siglens:recent-searches',
}));

describe('useRecentSearches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRecentSearches.mockReturnValue([]);
    });

    it('returns an empty recentSearches array initially', () => {
        const { result } = renderHook(() => useRecentSearches());

        expect(result.current.recentSearches).toEqual([]);
    });

    it('returns addSearch, removeSearch, and clearAll functions', () => {
        const { result } = renderHook(() => useRecentSearches());

        expect(typeof result.current.addSearch).toBe('function');
        expect(typeof result.current.removeSearch).toBe('function');
        expect(typeof result.current.clearAll).toBe('function');
    });

    it('calls addRecentSearch when addSearch is invoked', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.addSearch('AAPL');
        });

        expect(mockAddRecentSearch).toHaveBeenCalledWith('AAPL');
    });

    it('calls removeRecentSearch when removeSearch is invoked', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.removeSearch('AAPL');
        });

        expect(mockRemoveRecentSearch).toHaveBeenCalledWith('AAPL');
    });

    it('calls clearRecentSearches when clearAll is invoked', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.clearAll();
        });

        expect(mockClearRecentSearches).toHaveBeenCalled();
    });

    it('dispatches a custom event when addSearch is called', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.addSearch('MSFT');
        });

        const dispatched = dispatchSpy.mock.calls.find(
            call => (call[0] as Event).type === 'siglens:recent-searches-change'
        );
        expect(dispatched).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('dispatches a custom event when removeSearch is called', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.removeSearch('MSFT');
        });

        const dispatched = dispatchSpy.mock.calls.find(
            call => (call[0] as Event).type === 'siglens:recent-searches-change'
        );
        expect(dispatched).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('dispatches a custom event when clearAll is called', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.clearAll();
        });

        const dispatched = dispatchSpy.mock.calls.find(
            call => (call[0] as Event).type === 'siglens:recent-searches-change'
        );
        expect(dispatched).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('returns stable callback references across re-renders', () => {
        const { result, rerender } = renderHook(() => useRecentSearches());
        const firstAdd = result.current.addSearch;
        const firstRemove = result.current.removeSearch;
        const firstClear = result.current.clearAll;

        rerender();

        expect(result.current.addSearch).toBe(firstAdd);
        expect(result.current.removeSearch).toBe(firstRemove);
        expect(result.current.clearAll).toBe(firstClear);
    });
});
