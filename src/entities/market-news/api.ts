import 'server-only';
import { cache } from 'react';
import { and, desc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import type { NewsCardAnalysis } from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { getDatabaseClient } from '@/shared/db/client';
import { marketNews } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { MarketNewsCardItem } from './lib/toCardItem';
import type { Locale } from '@/shared/i18n/locales';
import { TRANSLATABLE_ENTITY } from '@/shared/db/contentTranslationFields';
// 종목 뉴스 슬라이스와 같은 강제 변환을 쓴다 — 두 벌을 두면 core가 enum 값을
// 추가했을 때 한쪽만 갱신돼 그 슬라이스에서만 조용히 null로 떨어진다.
import {
    toNewsCategory,
    toNewsImpact,
    toNewsSentiment,
} from '@/shared/lib/news/newsEnumCoercion';
import { toLocalizedDisplayItems } from '@/shared/lib/news/toLocalizedDisplayItems';
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
                    // 동률 tie-break — `/news/[category]`가 앞에서 N개를 잘라
                    // 쓰므로, 같은 시각 행들의 상대 순서가 정해지지 않으면
                    // 경계에 걸친 행이 재생성마다 바뀌어 ISR 블롭이 흔들린다.
                    .orderBy(desc(marketNews.publishedAt), desc(marketNews.id)),
            NEON_TRANSIENT_RETRY
        );

        return rows.map(toMarketNewsRow);
    }

    /**
     * 카드 표시에 필요한 컬럼만 읽는다 — `bodyEn`을 select에서 뺀다.
     *
     * 종목 뉴스 슬라이스의 `listCardsBySymbol`과 같은 이유다: 3초 폴링과 목록
     * 렌더는 본문을 받아서 버리는데, 예전의 JS 투영(`toMarketNewsCardItem`)은
     * **받은 뒤** 거르는 방식이라 Neon 전송과 S3 ISR 블롭에는 그대로 남았다
     * (감사: 비용 라운드 15). 그래서 그 함수는 지우고 SELECT로 옮겼다.
     * `listByCategory`도 이제 본문을 읽지 않는다 — 그쪽 소비자(다이제스트 프롬프트)가
     * 그 값을 안 쓰기 때문이다(`toMarketNewsRow` 주석 참조). 두 읽기의 차이는
     * `symbol`/`analyzedAt` 유무뿐이다 — 필터·정렬·창은 동일하다.
     */
    async listCardsByCategory(
        sentinel: string,
        sinceMs: number,
        locale: Locale
    ): Promise<MarketNewsCardItem[]> {
        const cutoff = new Date(Date.now() - sinceMs);

        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: marketNews.id,
                        source: marketNews.source,
                        url: marketNews.url,
                        publishedAt: marketNews.publishedAt,
                        titleEn: marketNews.titleEn,
                        titleKo: marketNews.titleKo,
                        bodyKo: marketNews.bodyKo,
                        summaryKo: marketNews.summaryKo,
                        sentiment: marketNews.sentiment,
                        category: marketNews.category,
                        priceImpact: marketNews.priceImpact,
                        tickers: marketNews.tickers,
                    })
                    .from(marketNews)
                    .where(
                        and(
                            eq(marketNews.symbol, sentinel),
                            gte(marketNews.publishedAt, cutoff)
                        )
                    )
                    // 동률 tie-break — `/news/[category]`가 앞에서 N개를 잘라
                    // 쓰므로, 같은 시각 행들의 상대 순서가 정해지지 않으면
                    // 경계에 걸친 행이 재생성마다 바뀌어 ISR 블롭이 흔들린다.
                    .orderBy(desc(marketNews.publishedAt), desc(marketNews.id)),
            NEON_TRANSIENT_RETRY
        );

        // 카드 투영·해석은 종목 뉴스와 같은 함수를 쓴다 — 컬럼도 소비자도
        // 같은데 슬라이스마다 따로 구현하면 한쪽만 고쳐진다.
        const localized = await toLocalizedDisplayItems(
            rows,
            locale,
            TRANSLATABLE_ENTITY.marketNews
        );
        return localized.map((item, index) => ({
            ...item,
            tickers: rows[index]!.tickers,
        }));
    }

    /**
     * 이 창에서 이미 분석된 기사 id만 읽는다 — 필터를 SQL로 내려 id만 오게 한다
     * (감사: 비용 라운드 15, 종목 뉴스 `listAnalyzedIds`와 대칭).
     */
    async listAnalyzedIds(
        sentinel: string,
        sinceMs: number
    ): Promise<Set<string>> {
        const cutoff = new Date(Date.now() - sinceMs);

        const rows = await withRetry(
            () =>
                this.db
                    .select({ id: marketNews.id })
                    .from(marketNews)
                    .where(
                        and(
                            eq(marketNews.symbol, sentinel),
                            gte(marketNews.publishedAt, cutoff),
                            isNotNull(marketNews.analyzedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );

        return new Set(rows.map(row => row.id));
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
/**
 * 카드 표시용 목록.
 *
 * `getMarketNewsList`와의 차이는 `symbol`/`analyzedAt` 유무뿐이다 — 그쪽도 이제
 * 본문(`body_en`)을 읽지 않는다(`toMarketNewsRow` 주석 참조). 즉 "본문이 필요하면
 * 저쪽"이라는 구분은 더 이상 없고, 집계·다이제스트 프롬프트도 본문을 안 읽는다.
 */
export const getMarketNewsCards = cache(
    async (sentinel: string, locale: Locale): Promise<MarketNewsCardItem[]> => {
        const { db } = getDatabaseClient();
        return new DrizzleMarketNewsRepository(db).listCardsByCategory(
            sentinel,
            MARKET_NEWS_LOOKBACK_MS,
            locale
        );
    }
);

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
    /** 이 경로에서는 select하지 않는다 — `toNewsRow`/`toMarketNewsRow` 주석 참조. */
    bodyEn?: string | null;
    titleKo: string | null;
    bodyKo: string | null;
    summaryKo: string | null;
    sentiment: string | null;
    category: string | null;
    priceImpact: string | null;
    tickers: string[];
    analyzedAt: Date | null;
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
        // 읽지 않는다 — 사유는 `news-article/api.ts`의 `toNewsRow` 주석 참조
        // (다이제스트 프롬프트도 이 필드를 읽지 않는다).
        bodyEn: null,
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
