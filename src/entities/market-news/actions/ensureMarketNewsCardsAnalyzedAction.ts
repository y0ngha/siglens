'use server';

import { ingestMarketNewsCategory } from '@/entities/market-news/api/ingestMarketNewsCategory';
import type { NewsFeedCategoryId } from '../lib/categoryConfig';

/**
 * Server Action: fetch fresh market-news for `category` (소스는 카테고리가 정한다 —
 * 미국·암호화폐는 FMP, 한국은 네이버), upsert to the
 * `market_news` table, and trigger per-card AI analysis for unenriched items.
 *
 * Unlike the per-symbol equivalent, there is NO tier/BYOK gate — category
 * digests are public. 본문은 `ingestMarketNewsCategory`에 있다 — 허브 프리웜
 * 크론이 같은 적재를 방문과 무관하게 돌리므로 한 곳에 둔다.
 *
 * 방문자 경로는 보강 상한을 두지 않는다(예전과 같음). 크론만 유닛 상한 때문에 건다.
 *
 * Designed to run inside `waitUntil` so it does not block the response stream.
 * Never throws — failures are logged.
 */
export async function ensureMarketNewsCardsAnalyzedAction(
    category: NewsFeedCategoryId
): Promise<void> {
    try {
        await ingestMarketNewsCategory(category, {
            logLabel: 'ensureMarketNewsCardsAnalyzedAction',
        });
    } catch (error) {
        console.error('[ensureMarketNewsCardsAnalyzedAction]', error);
    }
}
