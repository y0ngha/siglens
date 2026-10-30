'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useOpenTickerSearch } from '@/features/watchlist/hooks/useOpenTickerSearch';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import type { WatchlistSort } from '@/features/watchlist/lib/sortWatchlist';
import {
    watchlistPanelId,
    watchlistTabId,
} from '@/features/watchlist/lib/watchlistTabs';
import { RecentSymbolsList } from '@/features/watchlist/ui/RecentSymbolsList';
import { WatchlistTabs } from '@/features/watchlist/ui/WatchlistTabs';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useWatchlistPageTab } from './hooks/useWatchlistPageTab';
import { isWatchlistListPending } from './lib/watchlistListState';
import { WatchlistSortSelect } from './ui/toolbar/WatchlistSortSelect';
import { WatchlistSection } from './WatchlistSection';

/**
 * `/watchlist` 본문 — 탭(관심 | 최근 본), 관심 탭의 정렬, 종목 담기 버튼과 탭 패널. 탭은 URL
 * 쿼리에 남고(`useWatchlistPageTab`), 정렬은 저장하지 않는 보는 동안만의 선택이다.
 */
export function WatchlistPageContent() {
    const t = useTranslations('features.watchlist');
    const idBase = useId();
    const [sort, setSort] = useState<WatchlistSort>('added');
    const [tab, changeTab] = useWatchlistPageTab();
    const { items, isHydrated, isIdentityPending } = useWatchlist();
    const openSearch = useOpenTickerSearch();
    // 목록이 로딩을 그리는 동안엔 개수도 그리지 않는다 — 회원 여부를 모를 때의 0은 "계정에 없음"이 아니다.
    const isListPending = isWatchlistListPending({
        isHydrated,
        isIdentityPending,
        itemCount: items.length,
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary-700 pb-3">
                <WatchlistTabs
                    value={tab}
                    onChange={changeTab}
                    watchlistCount={isListPending ? null : items.length}
                    idBase={idBase}
                    size="md"
                />
                <div className="flex items-center gap-2">
                    {tab === 'watchlist' && (
                        <WatchlistSortSelect value={sort} onChange={setSort} />
                    )}
                    <button
                        type="button"
                        onClick={openSearch}
                        className={cn(BUTTON_PRIMARY, 'h-10 px-4 text-sm')}
                    >
                        {t('common.add')}
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
