import type { EnrichedNewsItem } from '@y0ngha/siglens-core';
import { isEnrichedRow, toEnrichedNewsItem } from '@/entities/news-article';
import type { MarketNewsRow } from '../model';

/**
 * Picks only the fields that `isEnrichedRow` / `toEnrichedNewsItem` inspect.
 * Explicit mapping surfaces any future shape drift between the two entities
 * as a compile-time TS error rather than a silent runtime mismatch.
 *
 * Shared by `submitMarketNewsDigestAction` (write path) and
 * `peekMarketNewsDigestStatic` (SSR read path) — both must build the exact
 * same `EnrichedNewsItem[]` from a `MarketNewsRow[]` for the digest cache
 * key to line up (core's `MarketNewsDigestCacheKeyOptions.news` folds into
 * the key). A single implementation makes that parity structural instead of
 * something both call sites have to remember to keep in sync.
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

/** Maps a `MarketNewsRow` to core's `EnrichedNewsItem`, or `null` if not yet analyzed. */
export function toEnrichedMarketNewsItem(
    row: MarketNewsRow
): EnrichedNewsItem | null {
    const shaped = toEnrichedRowShape(row);
    if (!isEnrichedRow(shaped)) return null;
    return toEnrichedNewsItem(shaped);
}
