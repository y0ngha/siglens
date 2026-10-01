import 'server-only';
import {
    peekMarketNewsDigestCache,
    type NewsAnalysisResponse,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { cacheNonNull } from '@/shared/cache/cacheNonNull';
import { selectAggregateNewsItems } from '@/entities/news-article/lib/newsAnalysisSelection';
import { getMarketNewsList } from '@/entities/market-news/api/marketNewsRepository';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import { toEnrichedMarketNewsItem } from '../lib/toEnrichedMarketNewsItem';

/**
 * `peekMarketNewsDigestStatic`의 카테고리별 캐시 태그. 무효화하는 쪽(허브 프리웜 등)은
 * 반드시 이 빌더를 써야 한다 — 따로 철자하면 한쪽만 바뀌는 순간 무효화가 빗나가 ISR이
 * stale하게 남는다.
 */
export function marketNewsDigestCacheTag(category: NewsFeedCategoryId): string {
    return `market-news:digest:${category}`;
}

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
 * error) resolves to `null` (never cached — see `cacheNonNull`) so the client falls back to
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
    // `cacheNonNull` — miss(`null`)는 캐시하지 않고 SSR miss로 표시한다. 예전에는 그
    // `null`이 12h 굳어, 방문자가 곧 다이제스트를 생성해도 페이지는 반나절 비어 있었다.
    // 읽기 실패도 `null`(플레이스홀더)로 degrade한다 — 예전 try/catch와 같다.
    return cacheNonNull(
        () => computeDigestPeek(category, locale),
        ['market-news-digest-peek-static', category, locale],
        {
            revalidate: SECONDS_PER_HALF_DAY,
            tags: [marketNewsDigestCacheTag(category)],
        }
    );
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
