/** 관심종목 목록의 두 탭. 헤더 미리보기·홈 카드·`/watchlist`가 같은 값을 쓴다. */
export type WatchlistPreviewTab = 'watchlist' | 'recent';

/** `/watchlist`가 탭을 싣는 쿼리 이름. */
export const WATCHLIST_TAB_PARAM = 'tab';

/** "전체 보기"의 목적지. 최근 본 탭에서 누르면 그 탭이 열린 채로 간다. */
export function watchlistPageHref(tab: WatchlistPreviewTab): string {
    return tab === 'recent'
        ? `/watchlist?${WATCHLIST_TAB_PARAM}=recent`
        : '/watchlist';
}

/** URL의 `?tab=recent`를 탭으로. 그 밖의 값·없음은 관심 탭이다. */
export function tabFromParam(value: string | null): WatchlistPreviewTab {
    return value === 'recent' ? 'recent' : 'watchlist';
}

/** 탭 버튼 id. 한 화면에 탭이 둘 이상 뜰 수 있어 호출부의 `useId`를 접두사로 받는다. */
export function watchlistTabId(
    idBase: string,
    tab: WatchlistPreviewTab
): string {
    return `${idBase}-tab-${tab}`;
}

/** 두 탭이 번갈아 가리키는 패널 하나의 id. */
export function watchlistPanelId(idBase: string): string {
    return `${idBase}-panel`;
}
