'use client';

import { useState } from 'react';
import type { WatchlistPreviewTab } from '../lib/watchlistTabs';
import {
    useWatchlistPreview,
    type UseWatchlistPreviewResult,
    type WatchlistPreviewItem,
} from './useWatchlistPreview';

/** `useWatchlistPreviewTabs`의 반환값 — 미리보기 원천에 지금 탭과 그 탭의 행을 더한다. */
export interface UseWatchlistPreviewTabsResult extends UseWatchlistPreviewResult {
    /** 사용자가 고른 탭, 고르지 않았으면 `defaultTab`. */
    tab: WatchlistPreviewTab;
    selectTab: (tab: WatchlistPreviewTab) => void;
    /** 지금 탭의 전체 행(자르는 것은 화면이 정한다). */
    rows: WatchlistPreviewItem[];
}

/**
 * 헤더 미리보기와 홈 카드가 함께 쓰는 `관심 | 최근 본` 탭 상태. 고르기 전에는 `defaultTab`을
 * 따라가므로, 담은 것이 하이드레이션 뒤에 도착해도 첫 탭이 그에 맞춰 바뀐다.
 */
export function useWatchlistPreviewTabs(): UseWatchlistPreviewTabsResult {
    const [chosenTab, setChosenTab] = useState<WatchlistPreviewTab | null>(
        null
    );
    const preview = useWatchlistPreview();

    const tab = chosenTab ?? preview.defaultTab;
    const rows = tab === 'watchlist' ? preview.watchlist : preview.recent;

    return { ...preview, tab, selectTab: setChosenTab, rows };
}
