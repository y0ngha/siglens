import type { EnrichedNewsItem, NewsImpact } from '@y0ngha/siglens-core';

/**
 * Maximum number of articles fed into the AGGREGATE news analysis prompt.
 * High-news-volume tickers (e.g. NVDA) can return hundreds of enriched rows
 * within the 30-day window; without a cap the prompt explodes (cost, latency,
 * lost-in-the-middle). We keep the most market-moving articles and drop the rest.
 */
export const MAX_AGGREGATE_NEWS_ITEMS = 25;

/** Higher number = more market-moving. Drives the aggregate-prompt selection order. */
const IMPACT_RANK: Record<NewsImpact, number> = {
    high: 3,
    medium: 2,
    low: 1,
    negligible: 0,
};

/**
 * Select the articles that go into the aggregate news analysis prompt:
 * sort by per-card `priceImpact` (high > medium > low > negligible) so the most
 * market-moving articles come first, then take the top {@link MAX_AGGREGATE_NEWS_ITEMS}.
 *
 * Pure and non-mutating — the input array is left untouched. Ties keep their
 * incoming order (`toSorted` is stable), so the caller's recency ordering is
 * preserved within an impact bucket.
 */
export function selectAggregateNewsItems(
    items: ReadonlyArray<EnrichedNewsItem>
): EnrichedNewsItem[] {
    return items
        .toSorted(
            (a, b) =>
                IMPACT_RANK[b.card.priceImpact] -
                IMPACT_RANK[a.card.priceImpact]
        )
        .slice(0, MAX_AGGREGATE_NEWS_ITEMS);
}
