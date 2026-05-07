import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type {
    NewsCardAnalysis,
    NewsCategory,
    NewsImpact,
    NewsItem,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { news } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import type { NewsDisplayItem } from '@/domain/types';

/** Domain-level row returned from the `news` table; extends the display projection with persistence-only fields. */
export interface NewsRow extends NewsDisplayItem {
    /** Original English body — needed for re-analysis but not displayed. */
    bodyEn: string | null;
    /** Symbol/issuer the news belongs to — present on `NewsItem` but not in `NewsDisplayItem`. */
    symbol: string;
    /** Timestamp the LLM analysis was attached; null before analysis. */
    analyzedAt: Date | null;
}

export class DrizzleNewsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    // Identity fields only on conflict — analysis columns (titleKo, sentiment, etc.) are written by attachAnalysis.
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
            /**
             * bodyKo intentionally NOT in the conflict update — it is
             * write-once via attachAnalysis() (the LLM translation step) to
             * avoid overwriting LLM-translated content with raw English on
             * every FMP refetch. The same reasoning applies to titleKo,
             * summaryKo, sentiment, category, priceImpact, and analyzedAt:
             * those columns belong to the analysis step, not the fetch step.
             */
            .onConflictDoUpdate({
                target: news.id,
                set: {
                    symbol: sql`excluded.symbol`,
                    source: sql`excluded.source`,
                    publishedAt: sql`excluded.published_at`,
                    titleEn: sql`excluded.title_en`,
                    bodyEn: sql`excluded.body_en`,
                },
            });
    }

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
                priceImpact: analysis.priceImpact,
                analyzedAt,
            })
            .where(eq(news.id, id));
    }

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
                priceImpact: news.priceImpact,
                analyzedAt: news.analyzedAt,
            })
            .from(news)
            .where(and(eq(news.symbol, symbol), gte(news.publishedAt, cutoff)))
            .orderBy(desc(news.publishedAt));

        return rows.map(toNewsRow);
    }
}

/** Shape of a single row read from the `news` table. */
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
    priceImpact: string | null;
    analyzedAt: Date | null;
}

/**
 * Canonical enum values for the news analysis columns. The DB stores these
 * fields as raw text (no DB-level CHECK constraint), so we validate at the
 * read boundary instead of trusting the writer. Keep these arrays in sync
 * with the `NewsSentiment` / `NewsCategory` / `NewsImpact` types in
 * `@y0ngha/siglens-core`.
 */
const NEWS_SENTIMENTS = ['bullish', 'bearish', 'neutral'] as const;
const NEWS_CATEGORIES = [
    'earnings',
    'm_and_a',
    'guidance',
    'regulation',
    'macro',
    'product',
    'other',
] as const;
const NEWS_IMPACTS = ['high', 'medium', 'low', 'negligible'] as const;

function toNewsSentiment(value: unknown): NewsSentiment | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    return NEWS_SENTIMENTS.includes(value as NewsSentiment)
        ? (value as NewsSentiment)
        : null;
}

function toNewsCategory(value: unknown): NewsCategory | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    return NEWS_CATEGORIES.includes(value as NewsCategory)
        ? (value as NewsCategory)
        : null;
}

function toNewsImpact(value: unknown): NewsImpact | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    return NEWS_IMPACTS.includes(value as NewsImpact)
        ? (value as NewsImpact)
        : null;
}

// DB는 sentiment/category/priceImpact를 raw text로 저장하므로 read 시점에 화이트리스트로 검증한다.
// 잘못된 값(스키마 변경, 수동 SQL 등)은 null로 떨어뜨려 표시 단 fallback이 처리하도록 한다.
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
        sentiment: toNewsSentiment(row.sentiment),
        category: toNewsCategory(row.category),
        priceImpact: toNewsImpact(row.priceImpact),
        analyzedAt: row.analyzedAt,
    };
}
