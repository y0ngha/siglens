/**
 * Branch coverage tests for useRecentSearches — targets uncovered branches in
 * subscribe (server-side early return, StorageEvent key check), getSnapshot
 * cache key, notify (window check).
 */

// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
} from '@/entities/ticker';
import { useRecentSearches } from '@/features/ticker-search/hooks/useRecentSearches';

// `vi.mock`은 import 블록 **뒤에** 모아 둔다 — import 사이에 끼우지 않는다
// (MISTAKES.md Tests §17). 호이스팅 덕에 동작은 같지만, 읽는 사람에게는
// import 순서가 실행 순서처럼 보인다.
vi.mock('@/entities/ticker', () => ({
    addRecentSearch: vi.fn(),
    clearRecentSearches: vi.fn(),
    removeRecentSearch: vi.fn(),
    relabelRecentSearches: vi.fn(),
    getRecentSearches: vi.fn().mockReturnValue([]),
    RECENT_SEARCHES_STORAGE_KEY: 'siglens_recent_searches',
}));

/**
 * 회사명 백필은 **서버 액션**을 부른다. mock하지 않으면 라벨이 심볼과 같은
 * 픽스처(`{ symbol: 'AAPL', label: 'AAPL' }`)마다 실제 액션이 유닛 테스트에서
 * 호출된다 — 실패가 `.catch`에 삼켜져 초록으로 통과하므로 신호도 남지 않는다.
 */
vi.mock('@/entities/ticker/actions', () => ({
    getAssetLabelsAction: vi.fn().mockResolvedValue({ labels: {}, failed: [] }),
}));

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

    it('re-renders when only the display label changes', () => {
        // 스냅샷 캐시 키가 심볼만 보면, 같은 종목을 회사명과 함께 다시 검색해도
        // 칩에는 옛 라벨(티커)이 그대로 남는다.
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'AAPL', label: 'AAPL' },
        ]);
        const { result, rerender } = renderHook(() => useRecentSearches());
        expect(result.current.recentSearches[0]?.label).toBe('AAPL');

        mockGetRecentSearches.mockReturnValue([
            { symbol: 'AAPL', label: '애플' },
        ]);
        act(() => {
            window.dispatchEvent(new Event('siglens:recent-searches-change'));
        });
        rerender();

        expect(result.current.recentSearches[0]?.label).toBe('애플');
    });

    it('keeps the same snapshot reference when nothing changed', () => {
        // 매 호출 새 배열을 돌려주면 useSyncExternalStore가 무한 렌더에 빠진다.
        mockGetRecentSearches.mockImplementation(() => [
            { symbol: 'AAPL', label: '애플' },
        ]);
        const { result, rerender } = renderHook(() => useRecentSearches());
        const first = result.current.recentSearches;
        rerender();
        expect(result.current.recentSearches).toBe(first);
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
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'AAPL', label: 'AAPL' },
        ]);

        const { result } = renderHook(() => useRecentSearches());

        expect(result.current.recentSearches).toEqual([
            { symbol: 'AAPL', label: 'AAPL' },
        ]);
    });

    it('handles storage event for matching key', () => {
        mockGetRecentSearches.mockReturnValue([]);

        const { result, rerender } = renderHook(() => useRecentSearches());

        // Change mock return to simulate storage change
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'MSFT', label: 'MSFT' },
        ]);

        // Dispatch storage event for the correct key
        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'siglens_recent_searches',
                })
            );
        });

        rerender();
        expect(result.current.recentSearches).toEqual([
            { symbol: 'MSFT', label: 'MSFT' },
        ]);
    });

    it('ignores storage event for non-matching key', () => {
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'AAPL', label: 'AAPL' },
        ]);

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
        expect(result.current.recentSearches).toEqual([
            { symbol: 'AAPL', label: 'AAPL' },
        ]);
    });
});
