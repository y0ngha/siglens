import {
    tabFromParam,
    watchlistPageHref,
    watchlistPanelId,
    watchlistTabId,
} from '@/features/watchlist/lib/watchlistTabs';

describe('watchlistTabs', () => {
    it('recent만 최근 본 탭이고 나머지는 관심 탭이다', () => {
        expect(tabFromParam('recent')).toBe('recent');
        expect(tabFromParam(null)).toBe('watchlist');
        expect(tabFromParam('other')).toBe('watchlist');
    });

    it('전체 보기 목적지는 최근 본 탭일 때만 쿼리를 싣는다', () => {
        expect(watchlistPageHref('watchlist')).toBe('/watchlist');
        expect(watchlistPageHref('recent')).toBe('/watchlist?tab=recent');
    });

    it('탭 id와 패널 id는 접두사를 공유하고 서로 다르다', () => {
        expect(watchlistTabId('x', 'recent')).toBe('x-tab-recent');
        expect(watchlistPanelId('x')).toBe('x-panel');
    });
});
