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
    /** Korean body translation; null before analysis. */
    bodyKo: string | null;
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

// DB는 sentiment/category/priceImpact를 raw text로 저장하므로 LLM 결과를 신뢰해 좁혀준다.
// 잘못된 값은 표시 단의 guard 함수들이 fallback 처리한다.
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
        // attachAnalysis가 NewsCardAnalysis 값으로만 write하므로 각 필드는 enum 또는 null로 신뢰 가능.
        sentiment: row.sentiment as NewsSentiment | null,
        category: row.category as NewsCategory | null,
        priceImpact: row.priceImpact as NewsImpact | null,
        analyzedAt: row.analyzedAt,
    };
}
