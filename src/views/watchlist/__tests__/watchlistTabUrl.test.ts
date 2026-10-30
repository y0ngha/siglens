import { WATCHLIST_TAB_PARAM } from '@/features/watchlist/lib/watchlistTabs';
import { hrefWithWatchlistTab } from '../lib/watchlistTabUrl';

describe('hrefWithWatchlistTab', () => {
    it('기본 탭이 아니면 탭 파라미터를 싣는다', () => {
        expect(
            hrefWithWatchlistTab('https://siglens.io/watchlist', 'recent')
        ).toBe(`https://siglens.io/watchlist?${WATCHLIST_TAB_PARAM}=recent`);
    });

    it('기본 탭이면 탭 파라미터만 지우고 다른 쿼리·해시는 둔다', () => {
        expect(
            hrefWithWatchlistTab(
                `https://siglens.io/en/watchlist?${WATCHLIST_TAB_PARAM}=recent&ref=home#list`,
                'watchlist'
            )
        ).toBe('https://siglens.io/en/watchlist?ref=home#list');
    });
});
