'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
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
    //
    // 행 수 상한도 여기서 건다. 이 액션은 **3초마다** 호출되므로, 화면이 다루지 않는
    // 행까지 매 tick 실어 보내면 한 번 실리는 RSC 페이로드보다 누적이 커진다
    // (AAPL 기준 1,417행). `compress: true` 이후로는 그 응답이 매번 오리진에서
    // gzip되기까지 해서 버스터블 인스턴스의 CPU 크레딧을 직접 갉는다.
    const rows = await repo.listCardsBySymbol(
        symbol,
        NEWS_LOOKBACK_MS,
        await resolveRequestLocale()
    );
    return rows.length > NEWS_ROW_SERIALIZATION_LIMIT
        ? rows.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
        : rows;
}
