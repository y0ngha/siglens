'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useOpenTickerSearch } from '@/shared/hooks/useOpenTickerSearch';
import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useWatchlist } from '../hooks/useWatchlist';
import type { WatchlistPreviewTab } from '../hooks/useWatchlistPreview';
import { isWatchlistSort, type WatchlistSort } from '../lib/sortWatchlist';
import { RecentSymbolsList } from './RecentSymbolsList';
import { WatchlistSection } from './WatchlistSection';
import {
    WatchlistTabs,
    watchlistPanelId,
    watchlistTabId,
} from './WatchlistTabs';

const TAB_PARAM = 'tab';

/** URL의 `?tab=recent`를 탭으로. 그 밖의 값·없음은 관심 탭이다. */
export function tabFromParam(value: string | null): WatchlistPreviewTab {
    return value === 'recent' ? 'recent' : 'watchlist';
}

/** 탭을 URL에 남긴다(새로고침·공유에 유지). 관심 탭은 기본값이라 파라미터를 지운다. */
function writeTabToUrl(tab: WatchlistPreviewTab): void {
    const url = new URL(window.location.href);
    if (tab === 'recent') url.searchParams.set(TAB_PARAM, 'recent');
    else url.searchParams.delete(TAB_PARAM);
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
    const urlTab = tabFromParam(useUrlSearchParam(TAB_PARAM));
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
                            <select
                                id={sortId}
                                value={sort}
                                onChange={event => {
                                    const next = event.target.value;
                                    if (isWatchlistSort(next)) setSort(next);
                                }}
                                // 이메일 리포트 설정의 시간 선택과 같은 셀렉트 언어 — 포커스는 테두리색 + 옅은 링.
                                className="h-10 w-32 touch-manipulation rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-100 transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40"
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
                            </select>
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
