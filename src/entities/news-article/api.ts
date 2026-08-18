import 'server-only';
import { revalidateTag } from 'next/cache';

import { cache } from 'react';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type {
    NewsCardAnalysis,
    NewsCategory,
    NewsImpact,
    NewsItem,
    NewsSentiment,
    EnrichedNewsItem,
    RunNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { runNewsAnalysis, DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { getDatabaseClient } from '@/shared/db/client';
import { news } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { withRetry } from '@/shared/lib/withRetry';
import {
    NEWS_LOOKBACK_MS,
    NEWS_ANALYSIS_LOOKBACK_MS,
} from './lib/newsLookback';
import { buildAnalysisNewsItems } from './lib/buildAnalysisNewsItems';
import { analyzeNewsCards } from './lib/analyzeNewsCards';
import { PREWARM_NEWS_CARD_LIMIT } from './lib/newsAnalysisConstants';
import {
    ingestNewsForSymbol,
    NewsIngestWriteError,
} from './lib/ingestNewsForSymbol';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';

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

/**
 * SEO pre-warm 전용 news submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitNewsAnalysisAction`의 비봇 경로를 요청-컨텍스트 없이 재현한다
 * (캐시 키 5축 정합: model default / tier free / reasoning false / 동일
 * fingerprint). 차이는 skipEnqueueIfMiss:false와 force 뿐.
 *
 * modelId는 익명/free 방문자가 실제로 보내는 기본값(`DEEPSEEK_V4_FLASH_MODEL`
 * — `SymbolModelContext`의 `useSelectedModel` 기본값과 동일)을 명시 전달한다.
 * core의 news submit 옵션은 `modelId`를 그대로 캐시 키에 사용하고 내부
 * fallback이 없으므로, 생략하면 익명 writer가 쓰는 키와 어긋난다.
 *
 * DB I/O(DrizzleNewsRepository)·cross-entity 조합(earnings-report)·외부 core
 * submit 호출을 하는 orchestration seam이라 entities/{slice}/lib/(순수 함수
 * 전용)이 아니라 api.ts에 위치한다 — MISTAKES.md Architecture §0.7.
 *
 * ⚠️ 요청 헤더 읽기·세션 사용자 조회·봇 판별·쿠키 접근 금지 — cron의
 * after() 컨텍스트에서 실행되며 React 요청 스코프가 없다.
 *
 * **ingest-before-read (2026-07-26 감사)** — `listBySymbol`을 읽기 전에
 * `ingestNewsForSymbol`로 FMP news를 먼저 채운다. 원래는 사람이 news 탭을
 * 방문할 때만(`ensureNewsCardsAnalyzedAction`) news 테이블이 채워졌는데,
 * pre-warm cron은 그 방문을 절대 만들지 않으므로 최근 30일(`NEWS_ANALYSIS_LOOKBACK_MS`)
 * 안에 아무도 안 본 심볼은 `listBySymbol`이 항상 빈 배열을 반환해 news 분석이
 * 영구 실패했다 — `overall`도 news에 의존하므로 함께 실패했다. 실측: 하베스트된
 * 221개 심볼 중 44개(20%)가 이 창에 걸렸고, 저-트래픽 크립토 알트코인이 가장
 * 심했다(처리된 크립토 ~15개 중 11개가 적용 가능한 3개 탭 중 technical만 확보).
 * cron은 사람 방문에 기대지 않고 스스로 완결돼야 한다(self-sufficient).
 *
 * ingest 실패(FMP 장애/402 등)는 fail-open — 배치의 다른 단위 격리 철학과
 * 동일하게 여기서 삼켜서 DB에 이미 있는 뉴스만으로 분석을 진행한다. FMP
 * 신규 호출 비용: pre-warm 방문마다 심볼당 1회 추가. 유니버스 295개, FMP
 * 한도 분당 300req, 배치는 5분 tick당 6심볼만 처리하므로 무시 가능한 증가분이다.
 */
export async function prewarmNews(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<RunNewsAnalysisResult> {
    // 리뷰 지적(PR #700): resolveAssetClass()는 내부적으로
    // resolveMarketProfile() → getAssetInfo()를 호출하는데, 아래
    // ingestNewsForSymbol도 profileId를 안 넘기면 resolveMarketProfile을 다시
    // 호출해 심볼당 밤마다 getAssetInfo Redis 왕복이 중복된다. 여기서 프로필을
    // 한 번만 resolve하고 assetClass는 그 결과에서 파생(resolveAssetClass가
    // 내부적으로 하는 것과 동일)한 뒤 ingestNewsForSymbol에 그대로 전달한다.
    const profileId = await resolveMarketProfile(symbol);
    const assetClass = getDescriptor(profileId).assetClass;
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    // cron은 방문 트래픽에 기대지 않는다 — 위 doc-comment "ingest-before-read" 참고.
    //
    // lookback을 분석 창(30일)으로 좁힌다: 사람 방문 경로는 뉴스 **목록**(180일)을
    // 채워야 하지만 cron은 바로 아래 `listBySymbol(NEWS_ANALYSIS_LOOKBACK_MS)`로
    // 30일치만 읽는다. 180일치를 받아 upsert하면 매일 밤 295심볼에 대해 읽지도 않을
    // 기사를 Neon에 쓰게 되고, 그 왕복이 배치 데드라인을 갉아먹는다(감사 F5).
    const ingested = await ingestNewsForSymbol(
        symbol,
        repo,
        NEWS_ANALYSIS_LOOKBACK_MS,
        profileId
    ).catch((err: unknown) => {
        // DB 광역 장애(과반 upsert 실패)는 삼키지 않고 올려보낸다 — 삼키면 비어 있는
        // DB를 그대로 분석해 빈약한 스냅샷을 generatedAt=now로 굳혀버려 다음 거래일
        // 경계까지 재시도조차 안 된다. 위로 던지면 배치의 유닛 단위 catch가 스냅샷을
        // 쓰지 않고 다음 tick이 재시도한다(감사 F2).
        if (err instanceof NewsIngestWriteError) throw err;
        // FMP 장애·402 등은 fail-open — DB에 이미 있는 뉴스로 계속 진행한다.
        console.error(`[prewarmNews] ingest failed for ${symbol}:`, err);
        return null;
    });

    // 새로 적재된 기사가 있으면 news 목록 캐시를 무효화한다. 이게 없으면 cron이
    // DB를 채워도 `getNewsList`의 staticSymbolCache(태그 `news:{SYMBOL}`, 12h)가
    // 빈 목록을 계속 서빙해, Fix B의 최대 성과가 최대 12시간 노출되지 않는다(감사 F1).
    // `revalidateTag('seo-snapshot:…')`는 다른 태그이고 전 탭 수렴 시에만 발화하므로
    // 이 경로를 대신하지 못한다.
    const changedCount =
        ingested?.upsertSettled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length ?? 0;
    if (changedCount > 0) {
        revalidateTag(`news:${symbol.toUpperCase()}`, 'max');
    }

    let [rows, next] = await Promise.all([
        repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
        getNextEarningsReport(symbol, db),
    ]);

    // 카드 보강(번역 + 라벨링). **이 단계를 건너뛰면 아래 분석은 항상 실패한다** —
    // `buildAnalysisNewsItems`가 `isEnrichedRow`로 미보강 행을 전부 걸러내고, core의
    // `runNewsAnalysis`는 빈 입력을 보고 `{status:'error', code:'no_news'}`를 돌려준다.
    // 그러면 `news`·`overall` 두 탭 스냅샷이 생성되지 않는다.
    //
    // 원래 보강은 방문자 경로(`ensureNewsCardsAnalyzedAction`)에만 있었다. 그래서
    // 사람이 찾지 않는 종목은 영원히 보강되지 않았고, 보강이 없으니 스냅샷이 없고,
    // 스냅샷이 없으니 페이지가 얇아 유입이 생기지 않는 자기강화 루프에 갇혔다.
    // (프로덕션 실측: 국내 20종목 전부 보강 0건 / AAPL 288건.)
    //
    // 상한(`PREWARM_NEWS_CARD_LIMIT`)을 두는 이유와 숫자 근거는 그 상수의 주석에 있다 —
    // 요지는 백로그가 큰 종목일수록 유닛 타임아웃에 걸린다는 것이고, 그게 바로 이
    // 수정이 겨냥한 종목들이다.
    //
    // 후보를 `ingested.fresh`에서만 뽑는다. 적재가 실패한 밤(fail-open, `null`)에는
    // 보강도 건너뛴다 — 그날은 새로 확인된 기사가 없으므로 DB의 어떤 행이 아직
    // 유효한 후보인지 판단할 근거가 없다. `fetchNewsForPeriod`는 델타가 아니라 30일
    // 창 전체를 매번 돌려주므로, 다음에 적재가 성공하면 남은 미보강 행이 그대로
    // 후보로 다시 잡힌다(자기 회복).
    const analyzedIds = new Set(
        rows.filter(r => r.analyzedAt !== null).map(r => r.id)
    );
    const unanalyzed =
        ingested?.fresh.filter(item => !analyzedIds.has(item.id)) ?? [];
    if (unanalyzed.length > 0) {
        await analyzeNewsCards(unanalyzed, repo, {
            limit: PREWARM_NEWS_CARD_LIMIT,
            logLabel: 'prewarmNews',
        });
        // 방금 채운 보강 결과를 반영해 다시 읽는다 — 이 재조회가 없으면 이번 tick은
        // 보강 비용만 쓰고 여전히 빈 입력으로 분석을 부른다.
        rows = await repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS);
    }

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
        buildAnalysisNewsItems(rows);

    return runNewsAnalysis({
        symbol,
        companyName,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        assetClass,
        ...(force ? { force: true } : {}),
    });
}
