import type {
    EnrichedNewsItem,
    NewsCardAnalysis,
    NewsCategory,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import type { NewsRow } from '@/infrastructure/db/newsRepository';

/** LLM-enriched NewsRow — titleKo/summaryKo/sentiment/category are guaranteed non-null; bodyKo stays optional. */
export interface EnrichedNewsRow extends NewsRow {
    titleKo: string;
    summaryKo: string;
    sentiment: NewsSentiment;
    category: NewsCategory;
    bodyKo: string | null;
}

/** Type predicate narrowing NewsRow to EnrichedNewsRow. */
export function isEnrichedRow(row: NewsRow): row is EnrichedNewsRow {
    return (
        row.titleKo !== null &&
        row.summaryKo !== null &&
        row.sentiment !== null &&
        row.category !== null
    );
}

/** Map an EnrichedNewsRow to siglens-core's EnrichedNewsItem shape. */
export function toEnrichedNewsItem(row: EnrichedNewsRow): EnrichedNewsItem {
    const card: NewsCardAnalysis = {
        titleKo: row.titleKo,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
    };
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        bodyEn: row.bodyEn,
        card,
    };
}
