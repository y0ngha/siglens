import type { WatchlistItemRecord } from '@/shared/db/types';
import type { WatchlistItemView } from '../model';

export function toWatchlistView(r: WatchlistItemRecord): WatchlistItemView {
    return {
        symbol: r.symbol,
        companyName: r.companyName,
        addedAt: r.createdAt.toISOString(),
    };
}
