import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';
import { news } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

/** Domain-level row returned from the `news` table. */
export interface NewsRow extends NewsItem {
    titleKo: string | null;
    bodyKo: string | null;
    summaryKo: string | null;
    /** LLM-assigned sentiment label; null before analysis. */
    sentiment: string | null;
    /** LLM-assigned news category; null before analysis. */
    category: string | null;
    analyzedAt: Date | null;
}

/**
 * Drizzle ORM implementation backed by the `news` table in Neon PostgreSQL.
 * Handles raw FMP article storage and LLM card-analysis attachment.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleNewsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Insert or update a news item by `id`.
     * Identity fields only — analysis columns are left unchanged on conflict.
     *
     * `rawPayload` is intentionally not written by upsertNewsItem.
     * The raw FMP payload is the FMP adapter's responsibility — if needed, a
     * future hook on the adapter side can write it via a separate update.
     */
    async upsertNewsItem(item: NewsItem): Promise<void> {
        await this.db
            .insert(news)
            .values({
                id: item.id,
                symbol: item.symbol,
                source: item.source,
                url: item.url,
                publishedAt: new Date(item.publishedAt),
                titleEn: item.titleEn,
                bodyEn: item.bodyEn ?? null,
            })
            .onConflictDoUpdate({
                target: news.id,
                set: {
                    symbol: sql`excluded.symbol`,
                    source: sql`excluded.source`,
                    titleEn: sql`excluded.title_en`,
                    bodyEn: sql`excluded.body_en`,
                },
            });
    }

    /**
     * Attach LLM-produced card analysis (translation + sentiment) to an
     * existing `news` row identified by `id`. Sets `analyzed_at` to
     * `analyzedAt` (defaults to `new Date()` when not supplied).
     */
    async attachAnalysis(
        id: string,
        analysis: NewsCardAnalysis,
        analyzedAt: Date = new Date()
    ): Promise<void> {
        await this.db
            .update(news)
            .set({
                titleKo: analysis.titleKo,
                bodyKo: analysis.bodyKo ?? null,
                summaryKo: analysis.summaryKo,
                sentiment: analysis.sentiment,
                category: analysis.category,
                analyzedAt,
            })
            .where(eq(news.id, id));
    }

    /**
     * List news articles for a symbol published within the last `sinceMs`
     * milliseconds, ordered by `publishedAt` descending.
     */
    async listBySymbol(symbol: string, sinceMs: number): Promise<NewsRow[]> {
        const cutoff = new Date(Date.now() - sinceMs);

        const rows = await this.db
            .select({
                id: news.id,
                symbol: news.symbol,
                source: news.source,
                url: news.url,
                publishedAt: news.publishedAt,
                titleEn: news.titleEn,
                bodyEn: news.bodyEn,
                titleKo: news.titleKo,
                bodyKo: news.bodyKo,
                summaryKo: news.summaryKo,
                sentiment: news.sentiment,
                category: news.category,
                analyzedAt: news.analyzedAt,
            })
            .from(news)
            .where(and(eq(news.symbol, symbol), gte(news.publishedAt, cutoff)))
            .orderBy(desc(news.publishedAt));

        return rows.map(toNewsRow);
    }
}

/** @internal Shape of a single row read from the `news` table. */
interface NewsDbRow {
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
    analyzedAt: Date | null;
}

/** Map a DB row to the {@link NewsRow} domain shape. */
function toNewsRow(row: NewsDbRow): NewsRow {
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt.toISOString(),
        titleEn: row.titleEn,
        bodyEn: row.bodyEn,
        titleKo: row.titleKo,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
        analyzedAt: row.analyzedAt,
    };
}
