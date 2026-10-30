'use client';

import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import {
    tabFromParam,
    WATCHLIST_TAB_PARAM,
    type WatchlistPreviewTab,
} from '@/features/watchlist/lib/watchlistTabs';
import { hrefWithWatchlistTab } from '../lib/watchlistTabUrl';

/**
 * `/watchlist`의 현재 탭과 탭 변경 함수. 탭은 URL 쿼리(`?tab=recent`)에 남아 새로고침·공유에
 * 유지된다 — 헤더 ★·홈 카드가 최근 본 탭에서 "전체 보기"를 누르면 그 탭이 열린 채로 온다.
 * 정적 페이지라 서버·하이드레이션 렌더는 관심 탭이고, 하이드레이션 직후 URL 값으로 바뀐다
 * (`useUrlSearchParam`). 고른 탭은 URL보다 앞서고 뒤로/앞으로 가기가 오면 다시 URL을 따른다.
 */
export function useWatchlistPageTab(): [
    WatchlistPreviewTab,
    (next: WatchlistPreviewTab) => void,
] {
    const urlTab = tabFromParam(useUrlSearchParam(WATCHLIST_TAB_PARAM));
    const [pickedTab, pickTab] = usePickUntilPopstate<WatchlistPreviewTab>();

    const changeTab = (next: WatchlistPreviewTab): void => {
        pickTab(next);
        window.history.replaceState(
            window.history.state,
            '',
            hrefWithWatchlistTab(window.location.href, next)
        );
    };

    return [pickedTab ?? urlTab, changeTab];
}
