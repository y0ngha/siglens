'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useOpenTickerSearch } from '../hooks/useOpenTickerSearch';
import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { NativeSelect } from '@/shared/ui/NativeSelect';
import { useWatchlist } from '../hooks/useWatchlist';
import {
    tabFromParam,
    WATCHLIST_TAB_PARAM,
    watchlistPanelId,
    watchlistTabId,
    type WatchlistPreviewTab,
} from '../lib/watchlistTabs';
import { isWatchlistSort, type WatchlistSort } from '../lib/sortWatchlist';
import { RecentSymbolsList } from './RecentSymbolsList';
import { WatchlistSection } from './WatchlistSection';
import { WatchlistTabs } from './WatchlistTabs';

/** 탭을 URL에 남긴다(새로고침·공유에 유지). 관심 탭은 기본값이라 파라미터를 지운다. */
function writeTabToUrl(tab: WatchlistPreviewTab): void {
    const url = new URL(window.location.href);
    if (tab === 'recent') url.searchParams.set(WATCHLIST_TAB_PARAM, 'recent');
    else url.searchParams.delete(WATCHLIST_TAB_PARAM);
    window.history.replaceState(window.history.state, '', url);
}

/**
 * `/watchlist` 본문. 탭(관심 | 최근 본)은 URL 쿼리(`?tab=recent`)에 남는다 — 헤더 ★·홈 카드가
 * 최근 본 탭에서 "전체 보기"를 누르면 그 탭이 열린 채로 온다. 정적 페이지라 서버·하이드레이션
 * 렌더는 관심 탭이고, 하이드레이션 직후 URL 값으로 바뀐다(`useUrlSearchParam`).
 */
export function WatchlistPageContent() {
    const t = useTranslations('features.watchlist');
    const idBase = useId();
    const sortId = useId();
    const urlTab = tabFromParam(useUrlSearchParam(WATCHLIST_TAB_PARAM));
    const [pickedTab, pickTab] = usePickUntilPopstate<WatchlistPreviewTab>();
    const tab = pickedTab ?? urlTab;
    const [sort, setSort] = useState<WatchlistSort>('added');
    const { items, isHydrated } = useWatchlist();
    const openSearch = useOpenTickerSearch();

    const handleTabChange = (next: WatchlistPreviewTab) => {
        pickTab(next);
        writeTabToUrl(next);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary-700 pb-3">
                <WatchlistTabs
                    value={tab}
                    onChange={handleTabChange}
                    watchlistCount={isHydrated ? items.length : null}
                    idBase={idBase}
                    size="md"
                />
                <div className="flex items-center gap-2">
                    {tab === 'watchlist' && (
                        <>
                            <label
                                htmlFor={sortId}
                                className="text-sm text-secondary-400"
                            >
                                {t('page.sort')}
                            </label>
                            <NativeSelect
                                wrapperClassName="w-32"
                                id={sortId}
                                value={sort}
                                onChange={event => {
                                    const next = event.target.value;
                                    if (isWatchlistSort(next)) setSort(next);
                                }}
                            >
                                {/* 키를 정적으로 적는다 — i18n 추출기는 동적 조회(`t(map[v])`)를 못 본다. */}
                                <option value="added">
                                    {t('page.sortAdded')}
                                </option>
                                <option value="change">
                                    {t('page.sortChange')}
                                </option>
                                <option value="name">
                                    {t('page.sortName')}
                                </option>
                            </NativeSelect>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={openSearch}
                        className={cn(BUTTON_PRIMARY, 'h-10 px-4 text-sm')}
                    >
                        {t('home.add')}
                    </button>
                </div>
            </div>
            <div
                role="tabpanel"
                id={watchlistPanelId(idBase)}
                aria-labelledby={watchlistTabId(idBase, tab)}
            >
                {tab === 'watchlist' ? (
                    <WatchlistSection sort={sort} />
                ) : (
                    <RecentSymbolsList />
                )}
            </div>
        </div>
    );
}
