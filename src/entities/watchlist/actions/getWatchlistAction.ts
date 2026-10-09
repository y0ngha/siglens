'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { toWatchlistView } from '../lib/toWatchlistView';
import type { WatchlistItemView } from '../model';

/**
 * 회원의 관심종목(최근 담은 순). 비로그인이면 `[]` — 던지지도 리다이렉트하지도 않는다.
 * 읽기 실패는 `getPortfolioHoldingsAction`과 같은 이유로 전파한다(React Query `queryFn`이라
 * 던진 오류는 `isError`가 될 뿐이고, 삼키면 일시 장애가 "담은 게 없음"과 구분되지 않는다).
 */
export async function getWatchlistAction(): Promise<WatchlistItemView[]> {
    const user = await getCurrentUser();
    if (user === null) return [];

    const { db } = getDatabaseClient();
    const rows = await new DrizzleWatchlistRepository(db).findByUser(user.id);
    return rows
        .map(toWatchlistView)
        .toSorted((a, b) => b.addedAt.localeCompare(a.addedAt));
}
