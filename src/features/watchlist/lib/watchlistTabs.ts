/** 관심종목 목록의 탭(표시 순서). 헤더 미리보기·홈 카드·`/watchlist`가 같은 값을 쓴다. */
export const WATCHLIST_TABS = ['watchlist', 'recent'] as const;
/** 탭 이름. URL `?tab=` 값은 `tabFromParam`으로 좁혀 이 타입이 된다. */
export type WatchlistPreviewTab = (typeof WATCHLIST_TABS)[number];
/** 따로 고르지 않았을 때의 탭. URL 쿼리에도 싣지 않는다. */
export const DEFAULT_WATCHLIST_TAB: WatchlistPreviewTab = 'watchlist';

/** 이 값이 탭 이름인가 — URL 쿼리처럼 임의 문자열을 탭으로 읽을 때. */
function isWatchlistTab(value: string | null): value is WatchlistPreviewTab {
    return (WATCHLIST_TABS as readonly (string | null)[]).includes(value);
}

/** `/watchlist`가 탭을 싣는 쿼리 이름. */
export const WATCHLIST_TAB_PARAM = 'tab';

/** "전체 보기"의 목적지. 최근 본 탭에서 누르면 그 탭이 열린 채로 간다. */
export function watchlistPageHref(tab: WatchlistPreviewTab): string {
    return tab === DEFAULT_WATCHLIST_TAB
        ? '/watchlist'
        : `/watchlist?${WATCHLIST_TAB_PARAM}=${tab}`;
}

/** URL의 `?tab=` 값을 탭으로. 모르는 값·없음은 기본 탭이다. */
export function tabFromParam(value: string | null): WatchlistPreviewTab {
    return isWatchlistTab(value) ? value : DEFAULT_WATCHLIST_TAB;
}

/** 방향키로 옮길 다음 탭(끝에서 처음으로 돈다). `delta`는 오른쪽 +1, 왼쪽 -1. */
export function adjacentWatchlistTab(
    tab: WatchlistPreviewTab,
    delta: 1 | -1
): WatchlistPreviewTab {
    const index = WATCHLIST_TABS.indexOf(tab);
    const next =
        (index + delta + WATCHLIST_TABS.length) % WATCHLIST_TABS.length;
    return WATCHLIST_TABS[next] ?? tab;
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
