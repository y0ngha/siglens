import {
    DEFAULT_WATCHLIST_TAB,
    WATCHLIST_TAB_PARAM,
    type WatchlistPreviewTab,
} from '@/features/watchlist/lib/watchlistTabs';

/**
 * 현재 주소에 탭을 실은 주소. 기본 탭(관심)은 파라미터를 지운다 — 공유 링크가 `/watchlist`로
 * 깔끔하게 남는다. 다른 쿼리와 해시는 그대로 둔다.
 */
export function hrefWithWatchlistTab(
    href: string,
    tab: WatchlistPreviewTab
): string {
    const url = new URL(href);
    if (tab === DEFAULT_WATCHLIST_TAB) {
        url.searchParams.delete(WATCHLIST_TAB_PARAM);
    } else {
        url.searchParams.set(WATCHLIST_TAB_PARAM, tab);
    }
    return url.toString();
}
