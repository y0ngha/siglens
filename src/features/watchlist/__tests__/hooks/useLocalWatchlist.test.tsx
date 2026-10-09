import { act, renderHook } from '@testing-library/react';
import { useLocalWatchlist } from '@/features/watchlist/hooks/useLocalWatchlist';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';

describe('useLocalWatchlist', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-09T00:00:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('처음엔 빈 목록이고 add → 목록·저장소에 반영된다', () => {
        const { result } = renderHook(() => useLocalWatchlist());
        expect(result.current.entries).toEqual([]);
        let added = false;
        act(() => {
            added = result.current.add({ symbol: 'aapl', label: '애플' });
        });
        expect(added).toBe(true);
        expect(result.current.entries).toEqual([
            {
                symbol: 'AAPL',
                label: '애플',
                addedAt: Date.parse('2026-10-09T00:00:00.000Z'),
            },
        ]);
        expect(localStorage.getItem(LOCAL_STORAGE_WATCHLIST_KEY)).toContain(
            'AAPL'
        );
    });

    it('remove·clear가 목록을 비운다', () => {
        const { result } = renderHook(() => useLocalWatchlist());
        act(() => {
            result.current.add({ symbol: 'AAPL', label: '애플' });
            result.current.add({ symbol: 'MSFT', label: 'MS' });
        });
        act(() => result.current.remove('AAPL'));
        expect(result.current.entries.map(e => e.symbol)).toEqual(['MSFT']);
        act(() => result.current.clear());
        expect(result.current.entries).toEqual([]);
    });

    it('다른 탭의 storage 이벤트(같은 키)를 반영한다', () => {
        const { result } = renderHook(() => useLocalWatchlist());
        act(() => {
            localStorage.setItem(
                LOCAL_STORAGE_WATCHLIST_KEY,
                JSON.stringify([
                    { symbol: 'TSLA', label: '테슬라', addedAt: 1 },
                ])
            );
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: LOCAL_STORAGE_WATCHLIST_KEY,
                })
            );
        });
        expect(result.current.entries.map(e => e.symbol)).toEqual(['TSLA']);
    });

    it('key가 null인 storage 이벤트(다른 탭의 clear)도 반영한다', () => {
        const { result } = renderHook(() => useLocalWatchlist());
        act(() => {
            result.current.add({ symbol: 'AAPL', label: '애플' });
        });
        act(() => {
            localStorage.clear();
            window.dispatchEvent(new StorageEvent('storage', { key: null }));
        });
        expect(result.current.entries).toEqual([]);
    });

    it('같은 내용이면 스냅샷 참조가 유지된다(무한 렌더 방지)', () => {
        const { result, rerender } = renderHook(() => useLocalWatchlist());
        act(() => {
            result.current.add({ symbol: 'AAPL', label: '애플' });
        });
        const first = result.current.entries;
        rerender();
        expect(result.current.entries).toBe(first);
    });
});
