import 'server-only';
import { cache } from 'react';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type {
    NewsCardAnalysis,
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { getDatabaseClient } from '@/shared/db/client';
import { marketNews } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { withRetry } from '@/shared/lib/withRetry';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';
import type { MarketNewsItem } from './lib/marketNewsClientPort';
import { MARKET_NEWS_LOOKBACK_MS } from './lib/marketNewsConstants';
import type { MarketNewsRow } from './model';

export class DrizzleMarketNewsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Upserts a market-news item and returns whether the row was actually
     * inserted or its content actually changed. Returns `false` when a re-fetch
     * produces identical content (so the caller can skip a `revalidateTag` call).
     *
     * Per the DEDUP_DECISION (Phase 0 appendix A): feeds are URL-disjoint so
     * `id = hashUrlToId(url)` is sufficient — no composite id needed.
     * The conflict `set` intentionally EXCLUDES `symbol` to implement
     * first-writer-wins bucket assignment — category ingestion must never steal
     * a row from another bucket.
     */
    async upsertMarketNewsItem(item: MarketNewsItem): Promise<boolean> {
        const changed = await withRetry(
            () =>
                this.db
                    .insert(marketNews)
                    .values({
                        id: item.id,
                        symbol: item.symbol,
                        source: item.source,
                        url: item.url,
                        publishedAt: new Date(item.publishedAt),
                        titleEn: item.titleEn,
                        bodyEn: item.bodyEn ?? null,
                        tickers: item.tickers,
                    })
                    /**
                     * `symbol` is intentionally EXCLUDED from both `set` and `setWhere`
                     * — the bucket sentinel is fixed at first insert so that concurrent
                     * category ingestion cannot move an article between buckets (DEDUP_DECISION).
                     *
                     * Analysis columns (titleKo/bodyKo/summaryKo/sentiment/category/
                     * priceImpact/analyzedAt) are write-once via `attachAnalysis()` and
                     * are also excluded from `set` to protect LLM-translated content.
                     *
                     * `setWhere IS DISTINCT FROM` + `.returning({id})` means the UPDATE
                     * fires only on genuine content changes, allowing callers to skip
                     * `revalidateTag` when nothing changed.
                     */
                    .onConflictDoUpdate({
                        target: marketNews.id,
                        set: {
                            source: sql`excluded.source`,
                            publishedAt: sql`excluded.published_at`,
                            titleEn: sql`excluded.title_en`,
                            bodyEn: sql`excluded.body_en`,
                            tickers: sql`excluded.tickers`,
                        },
                        setWhere: sql`
                            ${marketNews.source} IS DISTINCT FROM excluded.source OR
                            ${marketNews.publishedAt} IS DISTINCT FROM excluded.published_at OR
                            ${marketNews.titleEn} IS DISTINCT FROM excluded.title_en OR
                            ${marketNews.bodyEn} IS DISTINCT FROM excluded.body_en OR
                            ${marketNews.tickers} IS DISTINCT FROM excluded.tickers
                        `,
                    })
                    .returning({ id: marketNews.id }),
            NEON_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    /**
     * Attaches LLM analysis to an existing market-news row. Write-once at the
     * DB layer: the UPDATE filters on `analyzedAt IS NULL`, so a concurrent
     * second writer becomes a no-op rather than overwriting the first result.
     */
    async attachAnalysis(
        id: string,
        analysis: NewsCardAnalysis,
        analyzedAt: Date = new Date()
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .update(marketNews)
                    .set({
                        titleKo: analysis.titleKo,
                        bodyKo: analysis.bodyKo ?? null,
                        summaryKo: analysis.summaryKo,
                        sentiment: analysis.sentiment,
                        category: analysis.category,
                        priceImpact: analysis.priceImpact,
                        analyzedAt,
                    })
                    .where(
                        and(
                            eq(marketNews.id, id),
                            isNull(marketNews.analyzedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
    }

    /**
     * List market-news rows for a sentinel bucket published within `sinceMs`
     * milliseconds of now, ordered newest-first.
     */
    async listByCategory(
        sentinel: string,
        sinceMs: number
    ): Promise<MarketNewsRow[]> {
        const cutoff = new Date(Date.now() - sinceMs);

        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: marketNews.id,
                        symbol: marketNews.symbol,
                        source: marketNews.source,
                        url: marketNews.url,
                        publishedAt: marketNews.publishedAt,
                        titleEn: marketNews.titleEn,
                        bodyEn: marketNews.bodyEn,
                        titleKo: marketNews.titleKo,
                        bodyKo: marketNews.bodyKo,
                        summaryKo: marketNews.summaryKo,
                        sentiment: marketNews.sentiment,
                        category: marketNews.category,
                        priceImpact: marketNews.priceImpact,
                        tickers: marketNews.tickers,
                        analyzedAt: marketNews.analyzedAt,
                    })
                    .from(marketNews)
                    .where(
                        and(
                            eq(marketNews.symbol, sentinel),
                            gte(marketNews.publishedAt, cutoff)
                        )
                    )
                    .orderBy(desc(marketNews.publishedAt)),
            NEON_TRANSIENT_RETRY
        );

        return rows.map(toMarketNewsRow);
    }
}

/**
 * React.cache-memoized list reader for a sentinel category bucket.
 *
 * Deduplicates concurrent calls within the same React render tree (single HTTP
 * request). Cross-request caching is handled by `staticSymbolCache` /
 * `unstable_cache` at the page layer. Scope: `MARKET_NEWS_LOOKBACK_MS` (7 days).
 *
 * Placed in `api.ts` rather than `lib/` because it has a DB side effect and
 * is not a pure function (MISTAKES.md Architecture §0.7).
 */
export const getMarketNewsList = cache(
    async (sentinel: string): Promise<MarketNewsRow[]> => {
        const { db } = getDatabaseClient();
        return new DrizzleMarketNewsRepository(db).listByCategory(
            sentinel,
            MARKET_NEWS_LOOKBACK_MS
        );
    }
);

export interface MarketNewsDbRow {
    id: string;
    symbol: string;
    source: string;
    url: string;
    publishedAt: Date;
    titleEn: string;
    bodyEn: string | null;
    titleKo: string | null;
    bodyKo: string | null;
    summaryKo: string | null;
    sentiment: string | null;
    category: string | null;
    priceImpact: string | null;
    tickers: string[];
    analyzedAt: Date | null;
}

/**
 * Canonical enum values for the `market_news` analysis columns.
 * The DB stores these as raw `text` (no CHECK constraint), so we validate at
 * the read boundary. Invalid values (stale data, manual SQL, schema drift) are
 * coerced to `null` so the display layer falls back gracefully.
 *
 * The `Record<T, true>` shape enforces compile-time exhaustiveness against the
 * source-of-truth types in `@y0ngha/siglens-core`.
 */
const NEWS_SENTIMENT_RECORD: Record<NewsSentiment, true> = {
    bullish: true,
    bearish: true,
    neutral: true,
};
const NEWS_CATEGORY_RECORD: Record<NewsCategory, true> = {
    earnings: true,
    m_and_a: true,
    guidance: true,
    regulation: true,
    macro: true,
    product: true,
    other: true,
};
const NEWS_IMPACT_RECORD: Record<NewsImpact, true> = {
    high: true,
    medium: true,
    low: true,
    negligible: true,
};

function isNewsSentiment(value: string): value is NewsSentiment {
    return value in NEWS_SENTIMENT_RECORD;
}
function isNewsCategory(value: string): value is NewsCategory {
    return value in NEWS_CATEGORY_RECORD;
}
function isNewsImpact(value: string): value is NewsImpact {
    return value in NEWS_IMPACT_RECORD;
}

function toNewsSentiment(value: unknown): NewsSentiment | null {
    if (typeof value !== 'string') return null;
    return isNewsSentiment(value) ? value : null;
}
function toNewsCategory(value: unknown): NewsCategory | null {
    if (typeof value !== 'string') return null;
    return isNewsCategory(value) ? value : null;
}
function toNewsImpact(value: unknown): NewsImpact | null {
    if (typeof value !== 'string') return null;
    return isNewsImpact(value) ? value : null;
}

function toMarketNewsRow(row: MarketNewsDbRow): MarketNewsRow {
    const displayItem: NewsDisplayItem = {
        id: row.id,
        publishedAt: row.publishedAt.toISOString(),
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: toNewsSentiment(row.sentiment),
        category: toNewsCategory(row.category),
        priceImpact: toNewsImpact(row.priceImpact),
        url: row.url,
        source: row.source,
    };
    return {
        ...displayItem,
        bodyEn: row.bodyEn,
        symbol: row.symbol,
        tickers: row.tickers,
        analyzedAt: row.analyzedAt,
    };
}

// Lives in api.ts (not lib/) per Architecture §0.7 — lib/ must be pure.

const MARKET_NEWS_REFRESH_FLAG_TTL_MINUTES = 10;

/**
 * Market-news refresh flag TTL — bots that re-crawl within this window skip
 * the FMP fetch+upsert to avoid unnecessary API calls. Mirrors `newsRefreshFlag`
 * in `news-article` but keyed by sentinel symbol to keep slice isolation.
 */
export const MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS =
    MARKET_NEWS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

const _marketNewsFlag = createRedisFlag(
    (sentinel: string) => `market-news:refresh:${sentinel}`,
    MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS,
    '[marketNewsRefreshFlag]'
);

/** Returns true if this sentinel bucket was fetched within the TTL. Redis failure → false (always fetch). */
export const isRecentlyFetched = _marketNewsFlag.isSet;

/** Mark this sentinel bucket as "recently fetched". Redis failure → noop. */
export const markFetched = _marketNewsFlag.mark;
