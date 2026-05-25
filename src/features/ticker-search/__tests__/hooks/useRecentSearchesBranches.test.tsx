/**
 * Branch coverage tests for useRecentSearches — targets uncovered branches in
 * subscribe (server-side early return, StorageEvent key check), getSnapshot
 * cache key, notify (window check).
 */

// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';

vi.mock('@/entities/ticker', () => ({
    addRecentSearch: vi.fn(),
    clearRecentSearches: vi.fn(),
    removeRecentSearch: vi.fn(),
    getRecentSearches: vi.fn().mockReturnValue([]),
    RECENT_SEARCHES_STORAGE_KEY: 'siglens_recent_searches',
}));

import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
} from '@/entities/ticker';
import { useRecentSearches } from '@/features/ticker-search/hooks/useRecentSearches';

const mockGetRecentSearches = getRecentSearches as ReturnType<typeof vi.fn>;
const mockAddRecentSearch = addRecentSearch as ReturnType<typeof vi.fn>;
const mockRemoveRecentSearch = removeRecentSearch as ReturnType<typeof vi.fn>;
const mockClearRecentSearches = clearRecentSearches as ReturnType<typeof vi.fn>;

describe('useRecentSearches — branch coverage', () => {
    beforeEach(() => {
        mockGetRecentSearches.mockReturnValue([]);
    });

    it('returns empty array initially', () => {
        const { result } = renderHook(() => useRecentSearches());
        expect(result.current.recentSearches).toEqual([]);
    });

    it('addSearch calls addRecentSearch and dispatches event', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.addSearch('AAPL');
        });

        expect(mockAddRecentSearch).toHaveBeenCalledWith('AAPL');
        expect(dispatchSpy).toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });

    it('removeSearch calls removeRecentSearch and dispatches event', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.removeSearch('AAPL');
        });

        expect(mockRemoveRecentSearch).toHaveBeenCalledWith('AAPL');
        expect(dispatchSpy).toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });

    it('clearAll calls clearRecentSearches and dispatches event', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.clearAll();
        });

        expect(mockClearRecentSearches).toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });

    it('updates snapshot when getRecentSearches returns new data', () => {
        mockGetRecentSearches.mockReturnValue(['AAPL']);

        const { result } = renderHook(() => useRecentSearches());

        expect(result.current.recentSearches).toEqual(['AAPL']);
    });

    it('handles storage event for matching key', () => {
        mockGetRecentSearches.mockReturnValue([]);

        const { result, rerender } = renderHook(() => useRecentSearches());

        // Change mock return to simulate storage change
        mockGetRecentSearches.mockReturnValue(['MSFT']);

        // Dispatch storage event for the correct key
        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'siglens_recent_searches',
                })
            );
        });

        rerender();
        expect(result.current.recentSearches).toEqual(['MSFT']);
    });

    it('ignores storage event for non-matching key', () => {
        mockGetRecentSearches.mockReturnValue(['AAPL']);

        const { result } = renderHook(() => useRecentSearches());

        // Dispatch storage event for wrong key
        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'some_other_key',
                })
            );
        });

        // Should still have the original data
        expect(result.current.recentSearches).toEqual(['AAPL']);
    });
});
