'use client';

import { useTranslations } from 'next-intl';
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    adjacentWatchlistTab,
    WATCHLIST_TABS,
    watchlistPanelId,
    watchlistTabId,
    type WatchlistPreviewTab,
} from '../lib/watchlistTabs';

interface WatchlistTabsProps {
    value: WatchlistPreviewTab;
    onChange: (tab: WatchlistPreviewTab) => void;
    /** 관심 탭 라벨 옆 개수. 하이드레이션 전이면 null(숫자를 그리지 않는다). */
    watchlistCount: number | null;
    /** 탭과 패널을 잇는 id 접두사. 한 화면에 탭이 둘 이상 뜰 수 있어 호출부가 `useId`로 준다. */
    idBase: string;
    size?: 'sm' | 'md';
}

/**
 * `관심 N | 최근 본` 알약 탭. ARIA tabs 패턴 — 선택된 탭만 Tab 정지점이고 좌우 방향키로
 * 옮긴다. 패널은 하나(`watchlistPanelId`)를 두 탭이 번갈아 가리킨다.
 */
export function WatchlistTabs({
    value,
    onChange,
    watchlistCount,
    idBase,
    size = 'sm',
}: WatchlistTabsProps) {
    const t = useTranslations('features.watchlist');
    const refs = useRef<
        Partial<Record<WatchlistPreviewTab, HTMLButtonElement>>
    >({});

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = adjacentWatchlistTab(
            value,
            event.key === 'ArrowRight' ? 1 : -1
        );
        onChange(next);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={t('preview.tabsLabel')}
            className="flex items-center gap-1"
        >
            {WATCHLIST_TABS.map(tab => {
                const selected = tab === value;
                return (
                    <button
                        key={tab}
                        ref={node => {
                            if (node) refs.current[tab] = node;
                        }}
                        type="button"
                        role="tab"
                        id={watchlistTabId(idBase, tab)}
                        aria-selected={selected}
                        aria-controls={watchlistPanelId(idBase)}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(tab)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            'inline-flex touch-manipulation items-center gap-1 rounded-lg px-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                            size === 'md' ? 'h-10 text-sm' : 'h-9 text-sm',
                            selected
                                ? 'bg-secondary-700 font-semibold text-secondary-50'
                                : 'text-secondary-400 hover:text-secondary-200'
                        )}
                    >
                        {tab === 'watchlist'
                            ? t('preview.tabWatchlist')
                            : t('preview.tabRecent')}
                        {tab === 'watchlist' && watchlistCount !== null && (
                            <span className="tabular-nums">
                                {watchlistCount}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
