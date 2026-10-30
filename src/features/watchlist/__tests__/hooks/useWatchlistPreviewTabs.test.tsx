vi.mock('@/features/watchlist/hooks/useWatchlistPreview', () => ({
    useWatchlistPreview: vi.fn(),
}));

import { act, renderHook } from '@testing-library/react';
import { useWatchlistPreview } from '@/features/watchlist/hooks/useWatchlistPreview';
import { useWatchlistPreviewTabs } from '@/features/watchlist/hooks/useWatchlistPreviewTabs';

const WATCHLIST = [{ symbol: 'AAPL', name: '애플' }];
const RECENT = [{ symbol: 'TSLA', name: '테슬라' }];

function setPreview(defaultTab: 'watchlist' | 'recent') {
    vi.mocked(useWatchlistPreview).mockReturnValue({
        watchlist: WATCHLIST,
        recent: RECENT,
        isReady: true,
        defaultTab,
    });
}

describe('useWatchlistPreviewTabs', () => {
    it('고르기 전에는 defaultTab과 그 탭의 행을 쓴다', () => {
        setPreview('recent');
        const { result } = renderHook(() => useWatchlistPreviewTabs());
        expect(result.current.tab).toBe('recent');
        expect(result.current.rows).toBe(RECENT);
    });

    it('고르기 전에는 defaultTab이 바뀌면 따라간다', () => {
        setPreview('recent');
        const { result, rerender } = renderHook(() =>
            useWatchlistPreviewTabs()
        );
        setPreview('watchlist');
        rerender();
        expect(result.current.tab).toBe('watchlist');
        expect(result.current.rows).toBe(WATCHLIST);
    });

    it('고른 탭은 defaultTab보다 우선한다', () => {
        setPreview('watchlist');
        const { result } = renderHook(() => useWatchlistPreviewTabs());
        act(() => result.current.selectTab('recent'));
        expect(result.current.tab).toBe('recent');
        expect(result.current.rows).toBe(RECENT);
    });
});
