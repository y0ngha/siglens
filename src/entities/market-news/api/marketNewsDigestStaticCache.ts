import 'server-only';
import { unstable_cache } from 'next/cache';
import {
    peekMarketNewsDigestCache,
    type NewsAnalysisResponse,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { selectAggregateNewsItems } from '@/entities/news-article';
import { getMarketNewsList } from '../api';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import { toEnrichedMarketNewsItem } from '../lib/toEnrichedMarketNewsItem';

/**
 * /news/[category] SSR seed — read-only peek of the cached category digest.
 *
 * Builds the exact same `news` array `submitMarketNewsDigestAction` builds
 * (same `getMarketNewsList` query + `toEnrichedMarketNewsItem` +
 * `selectAggregateNewsItems`) and the same key-participating options
 * (`category`, `modelId`, `news`, `reasoning`, `locale`), because
 * `peekMarketNewsDigestCache` derives its cache key from those fields —
 * a mismatch reads a key nothing ever wrote and the peek misses forever
 * (core's own JSDoc warns about this). `categoryLabel`/`skipEnqueueIfMiss`/
 * `signal` are runtime-only and excluded from the key by core's
 * `MarketNewsDigestCacheKeyOptions`, so they are not built here either.
 *
 * Zero LLM cost, zero enqueue — cache miss (cold cache, no provider, read
 * error) resolves to `null` so the client falls back to
 * `runMarketNewsDigest` via `submitMarketNewsDigestAction`.
 *
 * `revalidate=SECONDS_PER_HALF_DAY` matches this page's own ISR cadence
 * (`/news/[category]/page.tsx` `revalidate = 43200`) rather than core's
 * digest cache TTL (24h) — the peek only needs to be at least as fresh as
 * the page itself regenerates.
 */
export async function peekMarketNewsDigestStatic(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<NewsAnalysisResponse | null> {
    try {
        return await unstable_cache(
            () => computeDigestPeek(category, locale),
            ['market-news-digest-peek-static', category, locale],
            {
                revalidate: SECONDS_PER_HALF_DAY,
                tags: [`market-news:digest:${category}`],
            }
        )();
    } catch (e) {
        console.error('[MarketNewsDigest/PeekStatic] failed:', e);
        return null;
    }
}

async function computeDigestPeek(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<NewsAnalysisResponse | null> {
    const { sentinel } = CATEGORY_CONFIG[category];
    const rows = await getMarketNewsList(sentinel);
    const enrichedItems = rows
        .map(toEnrichedMarketNewsItem)
        .filter(item => item !== null);
    const news = selectAggregateNewsItems(enrichedItems);

    return peekMarketNewsDigestCache({
        // Same cast as submitMarketNewsDigestAction — see that file's comment
        // for why 'kr' is safe here (core never branches on this value).
        category: category as NewsFeedCategory,
        locale,
        modelId: DEFAULT_DIGEST_MODEL_ID,
        news,
        reasoning: true,
    });
}
