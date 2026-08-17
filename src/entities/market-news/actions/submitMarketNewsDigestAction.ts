'use server';

import { headers } from 'next/headers';
import {
    runMarketNewsDigest,
    type EnrichedNewsItem,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import type { SubmitMarketNewsDigestActionResult } from './submitMarketNewsDigestActionTypes';
import { isBot } from '@/shared/api/isBot';
import { getMarketNewsList } from '../api';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import {
    isEnrichedRow,
    selectAggregateNewsItems,
    toEnrichedNewsItem,
} from '@/entities/news-article';
import type { MarketNewsRow } from '../model';

/**
 * Picks only the fields that `isEnrichedRow` / `toEnrichedNewsItem` inspect.
 * Explicit mapping surfaces any future shape drift between the two entities
 * as a compile-time TS error rather than a silent runtime mismatch.
 */
function toEnrichedRowShape(
    row: MarketNewsRow
): Parameters<typeof isEnrichedRow>[0] {
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        bodyEn: row.bodyEn,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
        priceImpact: row.priceImpact,
        analyzedAt: row.analyzedAt,
    };
}

function toEnrichedMarketNewsItem(row: MarketNewsRow): EnrichedNewsItem | null {
    const shaped = toEnrichedRowShape(row);
    if (!isEnrichedRow(shaped)) return null;
    return toEnrichedNewsItem(shaped);
}

/**
 * Server Action: submit a market-news category digest job.
 *
 * No tier/BYOK gate — the category digest is public and uses a fixed shared
 * model. Reads enriched rows from DB, maps through `isEnrichedRow`, caps via
 * `selectAggregateNewsItems`, and delegates to core `runMarketNewsDigest`.
 *
 * Bot traffic sets `skipEnqueueIfMiss: true` so crawler requests return
 * `miss_no_trigger` without dispatching a worker job.
 */
export async function submitMarketNewsDigestAction(
    category: NewsFeedCategory,
    signal?: AbortSignal
): Promise<SubmitMarketNewsDigestActionResult> {
    try {
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        // 알 수 없는 카테고리는 CATEGORY_CONFIG 접근 전에 차단한다.
        // TypeScript 타입으로는 방어되지만, 런타임 직렬화(SSE JSON 파라미터 등)에서
        // 타입이 우회될 수 있으므로 명시적 가드를 추가한다.
        if (!Object.hasOwn(CATEGORY_CONFIG, category)) {
            return { status: 'error', error: 'Failed to submit digest' };
        }
        const { sentinel, koLabel } = CATEGORY_CONFIG[category];
        const rows = await getMarketNewsList(sentinel);

        const enrichedItems: EnrichedNewsItem[] = rows
            .map(toEnrichedMarketNewsItem)
            .filter((item): item is EnrichedNewsItem => item !== null);

        // Cap to the top market-moving items to keep the digest prompt bounded.
        const news = selectAggregateNewsItems(enrichedItems);

        return await runMarketNewsDigest({
            category,
            categoryLabel: koLabel,
            modelId: DEFAULT_DIGEST_MODEL_ID,
            news,
            // 스펙상 non-thinking인 deepseek-v4-flash에서도 추론을 강제로 켠다.
            // 카테고리 피드 수십 건을 하나의 서술로 합성하는 작업이라 뉴스
            // 경로 중 추론 이득이 실제로 나오는 유일한 지점이고, Gemini에서
            // 넘어오기 전 동작(spec thinkingBudget 8192 = 추론 ON)과도 맞는다.
            // 추론 티어 모델(deepseek-v4-pro)로 올리는 것보다 훨씬 싸다.
            reasoning: true,
            skipEnqueueIfMiss,
            signal,
        });
    } catch (error) {
        console.error('[submitMarketNewsDigestAction]', error);
        return { status: 'error', error: 'Failed to submit digest' };
    }
}
