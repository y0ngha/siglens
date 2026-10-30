'use client';

import type { WatchlistItemView } from '@/entities/watchlist/model';
import { useWatchlistChanges } from '@/features/watchlist/hooks/useWatchlistChanges';
import {
    sortWatchlistItems,
    type WatchlistSort,
} from '@/features/watchlist/lib/sortWatchlist';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { watchlistDisplayName } from '../lib/watchlistDisplayName';

/**
 * 고른 기준으로 정렬한 관심 목록. 이름 순은 화면에 보이는 이름을 화면 로케일로 비교하고,
 * 등락률 순을 고르면 그때 모든 행의 시세를 구독한다(그 외에는 행이 보일 때만 불러온다).
 */
export function useSortedWatchlist(
    items: readonly WatchlistItemView[],
    sort: WatchlistSort
): WatchlistItemView[] {
    const assetLabel = useAssetLabel();
    const locale = useResolvedLocale();
    const changeBySymbol = useWatchlistChanges(items, sort === 'change');
    return sortWatchlistItems(items, sort, {
        nameOf: item => watchlistDisplayName(item, assetLabel),
        changeOf: item => changeBySymbol.get(item.symbol) ?? null,
        locale,
    });
}
