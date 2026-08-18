'use server';

import { getMarketNewsCards } from '../api';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import type { MarketNewsCardItem } from '../lib/toCardItem';

/**
 * Discriminated union result type for {@link getMarketNewsCardsAction}.
 *
 * Returns `ok: false` instead of throwing so the client polling hook can count
 * consecutive failures via the `ok: false` branch without an exception crossing
 * the network boundary (§0.7 — Server Actions must not surface raw DB errors
 * to the client).
 */
export type GetMarketNewsCardsResult =
    | { ok: true; items: MarketNewsCardItem[] }
    | { ok: false; error: string };

/**
 * Server Action: fetch the latest market-news card state from DB for a category.
 *
 * Called by `useMarketNewsCardPolling` and `useWaitForMarketNewsCards` on the
 * client to detect when pending cards (no sentiment / priceImpact) become
 * enriched by the background worker.
 * Intentionally NOT cached — each call must hit the DB to reflect the most
 * recent `attachAnalysis` writes.
 *
 * Uses `getMarketNewsCards` (React.cache-memoized) to deduplicate concurrent
 * calls within the same RSC render pass or the same Server Action invocation.
 *
 * 투영은 읽기(`listCardsByCategory`)의 SELECT가 한다 — DB 내부 컬럼
 * (bodyEn, symbol, analyzedAt)은 애초에 조회되지 않으므로 Server Action 응답에도
 * 실리지 않는다.
 */
export async function getMarketNewsCardsAction(
    category: NewsFeedCategoryId
): Promise<GetMarketNewsCardsResult> {
    try {
        const { sentinel } = CATEGORY_CONFIG[category];
        // 카드 리더는 본문 컬럼을 아예 읽지 않는다 — 받은 뒤 거르면 Neon 전송이
        // 3초 폴링마다 그대로 난다(감사: 비용 라운드 15).
        return { ok: true, items: await getMarketNewsCards(sentinel) };
    } catch (error) {
        console.error('[getMarketNewsCardsAction]', error);
        return { ok: false, error: 'db error' };
    }
}
