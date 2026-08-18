'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import type { NewsDisplayItem } from '@/shared/lib/types';

/**
 * Server Action: fetch the latest per-card analysis state from DB.
 *
 * Called by `useNewsCardPolling` on the client to detect when pending cards
 * (no sentiment / priceImpact) become enriched by the background worker.
 * Intentionally NOT cached — each call must hit the DB to reflect the
 * most recent `attachAnalysis` writes.
 */
export async function getNewsCardsAction(
    symbol: string
): Promise<NewsDisplayItem[]> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    // 카드 표시 컬럼만 읽는다 — `bodyEn`을 읽어서 버리지 않도록 select 단계에서
    // 뺀다(감사: 비용 라운드 14). 3초 폴링 경로라 낭비가 매 tick 반복됐다.
    // 리포지터리가 이미 `NewsDisplayItem[]`을 돌려주므로 여기서 다시 거를 것이 없다.
    return repo.listCardsBySymbol(symbol, NEWS_LOOKBACK_MS);
}
