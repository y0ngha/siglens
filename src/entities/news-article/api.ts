import { cache } from 'react';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type {
    NewsCardAnalysis,
    NewsCategory,
    NewsImpact,
    NewsItem,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { getDatabaseClient } from '@/shared/db/client';
import { news } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { withRetry } from '@/shared/lib/withRetry';
import { NEWS_LOOKBACK_MS } from './lib/newsLookback';

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

    /**
     * Upserts a news item and returns whether the row was actually inserted or
     * its content actually changed. Returns `false` when a re-fetch produces
     * identical content (so the caller can skip a `revalidateTag` call).
     *
     * Identity fields only on conflict — analysis columns (titleKo, sentiment,
     * etc.) are written by attachAnalysis() and intentionally excluded from the
     * conflict `set` to avoid overwriting LLM-translated content on every fetch.
     */
    async upsertNewsItem(item: NewsItem): Promise<boolean> {
        // Wrapped in withRetry: the Neon HTTP driver intermittently throws
        // `fetch failed` on connection recycling; retrying transparently
        // keeps single-item dropouts from leaving news cards permanently
        // un-upserted in the 250-item batch.
        const changed = await withRetry(
            () =>
                this.db
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
                     * bodyKo intentionally NOT in the conflict `set` — it is
                     * write-once via attachAnalysis() (the LLM translation step) to
                     * avoid overwriting LLM-translated content with raw English on
                     * every FMP refetch. The same reasoning applies to titleKo,
                     * summaryKo, sentiment, category, priceImpact, and analyzedAt:
                     * those columns belong to the analysis step, not the fetch step.
                     *
                     * `setWhere` makes the UPDATE fire only when at least one of the
                     * five fetch-owned columns actually differs from the stored row.
                     * Combined with `.returning({ id })`, a row is returned only on
                     * a genuine insert or a real update; an unchanged re-fetch
                     * returns an empty array, allowing the caller to skip ISR
                     * `revalidateTag` when nothing changed.
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
                        setWhere: sql`
                            ${news.symbol} IS DISTINCT FROM excluded.symbol OR
                            ${news.source} IS DISTINCT FROM excluded.source OR
                            ${news.publishedAt} IS DISTINCT FROM excluded.published_at OR
                            ${news.titleEn} IS DISTINCT FROM excluded.title_en OR
                            ${news.bodyEn} IS DISTINCT FROM excluded.body_en
                        `,
                    })
                    .returning({ id: news.id }),
            NEON_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    async attachAnalysis(
        id: string,
        analysis: NewsCardAnalysis,
        analyzedAt: Date = new Date()
    ): Promise<void> {
        // LLM 번역 결과는 비용/지연이 모두 큰 호출이라 transient `fetch failed` 한 번에
        // 영구적으로 분실되면 다음 fetch까지 카드가 `analyzed: null` 상태로 남는다.
        // upsertNewsItem과 동일한 retry 정책으로 자가 회복 가능하게 한다.
        await withRetry(
            () =>
                this.db
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
                    .where(eq(news.id, id)),
            NEON_TRANSIENT_RETRY
        );
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

/**
 * 동일 라우트 요청 내 동시 호출(예: NewsPage 본문 + NewsListSection)이 cache MISS 시
 * 팩토리를 동시에 실행하려 할 때 `React.cache`로 per-request dedup해 DB 중복 조회를 막는다.
 *
 * **scope**: React.cache는 단일 React 렌더 트리(= 단일 HTTP 요청) 내에서만 memoize한다.
 * /news와 /overall은 별개 HTTP 요청이므로 React.cache scope를 공유하지 않는다 —
 * 두 라우트 간 중복 방지는 호출자별 `staticSymbolCache` (ISR cross-request 캐시)가
 * 담당하고, React.cache는 같은 요청 내 factory 동시 호출에 대한 backstop이다.
 *
 * 같은 lookback window(NEWS_LOOKBACK_MS)로 listBySymbol을 감싸므로 호출자별 다른 윈도우가
 * 필요해지면 별도 함수로 분리해야 한다. cross-request 캐싱은 손실 — 이슈 #439 참조.
 *
 * 사이드 이펙트(DB I/O)가 있으므로 entities/news-article/api.ts에 배치
 * (entities/{slice}/lib/은 순수 함수 전용 — MISTAKES.md Architecture §0.7).
 */
export const getNewsList = cache(async (symbol: string): Promise<NewsRow[]> => {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    return repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
});

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
 * read boundary instead of trusting the writer.
 *
 * The `Record<T, true>` shape forces compile-time exhaustiveness against the
 * source-of-truth types in `@y0ngha/siglens-core` — if the core adds a new
 * `NewsSentiment` / `NewsCategory` / `NewsImpact` member, TypeScript will
 * reject this file until the new member is mirrored here, preventing the
 * silent "valid value gets coerced to null at the boundary" failure.
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
