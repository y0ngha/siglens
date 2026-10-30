import 'server-only';
import { and, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm';
import { cache } from 'react';
import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { getDatabaseClient } from '@/shared/db/client';
import { news } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NewsDisplayItem } from '@/shared/lib/types';
import type { Locale } from '@/shared/i18n/locales';
import { TRANSLATABLE_ENTITY } from '@/shared/db/contentTranslationFields';
import { toLocalizedDisplayItems } from '@/shared/lib/news/toLocalizedDisplayItems';
import { withRetry } from '@/shared/lib/withRetry';
import { NEWS_LOOKBACK_MS } from './lib/newsLookback';
import { toNewsRow } from './lib/toNewsRow';

/** `news` 테이블 행의 도메인 표현. 표시용 투영(`NewsDisplayItem`)에 영속 전용 필드를 더한다. */
export interface NewsRow extends NewsDisplayItem {
    /**
     * 항상 `null`이다 — 사유는 `toNewsRow`의 주석 참조.
     * core `EnrichedNewsItem` 형상을 맞추기 위한 placeholder다.
     */
    bodyEn: string | null;
    /** 기사가 속한 심볼 — core `NewsItem`에는 있지만 `NewsDisplayItem`에는 없다. */
    symbol: string;
    /** LLM 분석이 붙은 시각. 분석 전에는 null. */
    analyzedAt: Date | null;
}

/**
 * 심볼의 `sinceMs` 이내 기사만 고르는 조건. 읽기 쿼리가 모두 같은 창 의미를 쓰도록
 * 한 곳에 둔다.
 */
function inWindow(symbol: string, sinceMs: number): SQL | undefined {
    return and(
        eq(news.symbol, symbol),
        gte(news.publishedAt, new Date(Date.now() - sinceMs))
    );
}

/**
 * 최신순 정렬. 동률 tie-break로 `id`를 더한다: `publishedAt`만으로 정렬하면 같은 시각
 * 행들의 상대 순서가 정해지지 않는다. 소비자가 앞에서 N개를 잘라 쓰기 때문에
 * (`NEWS_ROW_SERIALIZATION_LIMIT`) 경계에 걸친 동률이 재생성마다 다른 행을 남겨 ISR
 * 블롭이 흔들릴 수 있다.
 */
const NEWEST_FIRST = [desc(news.publishedAt), desc(news.id)] as const;

/** `news` 테이블 접근 저장소. 쓰기(upsert·분석 부착)는 transient DB 오류를 재시도하고, 읽기는 재시도하지 않는다. */
export class DrizzleNewsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 기사를 upsert하고, 실제로 삽입됐거나 내용이 바뀌었는지를 돌려준다. 재fetch가 같은
     * 내용을 만들면 `false`라 호출부가 `revalidateTag`를 건너뛸 수 있다.
     *
     * 충돌 시에는 식별 필드만 갱신한다 — 분석 컬럼(titleKo, sentiment 등)은
     * `attachAnalysis()`가 쓰므로 `set`에서 의도적으로 뺀다. 매 fetch마다 LLM 번역
     * 결과를 덮어쓰지 않기 위해서다.
     */
    async upsertNewsItem(item: NewsItem): Promise<boolean> {
        // withRetry로 감싼다: 풀링된 DB 커넥션이 재활용 중에 끊길 수 있다
        // (`CONNECTION_CLOSED`/`ECONNRESET`). 투명하게 재시도해야 250건 배치에서
        // 한 건의 일시 장애가 뉴스 카드를 영구히 upsert되지 않은 채 남기지 않는다.
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
                     * bodyKo는 충돌 `set`에 의도적으로 넣지 않는다 — LLM 번역 단계
                     * (`attachAnalysis()`)가 한 번 쓰는 값이라, FMP를 다시 받을 때마다
                     * 번역본을 원문 영어로 덮어쓰지 않기 위해서다. titleKo, summaryKo,
                     * sentiment, category, priceImpact, analyzedAt도 같은 이유로
                     * fetch 단계가 아니라 분석 단계의 컬럼이다.
                     *
                     * `setWhere`는 fetch가 소유한 다섯 컬럼 중 하나라도 저장된 행과
                     * 다를 때만 UPDATE가 일어나게 한다. `.returning({ id })`와 합치면 진짜
                     * 삽입이나 실제 변경일 때만 행이 반환되고, 변화 없는 재fetch는 빈
                     * 배열이라 호출부가 ISR `revalidateTag`를 건너뛸 수 있다.
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
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    /**
     * 기사 한 건에 LLM 카드 분석 결과를 기록한다. `analyzedAt`이 찍히면 이후 패스는 그
     * 기사를 다시 분석하지 않는다.
     */
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
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 집계 분석·보강 후보 선별용 전체 행(`symbol`·`analyzedAt` 포함)을 최신순으로 읽는다.
     * 원문(`bodyEn`)은 읽지 않는다 — 사유는 `toNewsRow` 주석 참조.
     */
    async listBySymbol(symbol: string, sinceMs: number): Promise<NewsRow[]> {
        const rows = await this.db
            .select({
                id: news.id,
                symbol: news.symbol,
                source: news.source,
                url: news.url,
                publishedAt: news.publishedAt,
                titleEn: news.titleEn,
                titleKo: news.titleKo,
                bodyKo: news.bodyKo,
                summaryKo: news.summaryKo,
                sentiment: news.sentiment,
                category: news.category,
                priceImpact: news.priceImpact,
                analyzedAt: news.analyzedAt,
            })
            .from(news)
            .where(inWindow(symbol, sinceMs))
            .orderBy(...NEWEST_FIRST);

        return rows.map(toNewsRow);
    }

    /**
     * 이 창에서 이미 분석된 기사 id만 읽는다.
     *
     * 호출부는 "이미 분석됨" 집합만 필요하므로, 전 컬럼(본문 포함)을 읽어서 버리는 대신
     * 필터를 SQL로 내려 id만 가져온다.
     */
    async listAnalyzedIds(
        symbol: string,
        sinceMs: number
    ): Promise<Set<string>> {
        const rows = await this.db
            .select({ id: news.id })
            .from(news)
            .where(and(inWindow(symbol, sinceMs), isNotNull(news.analyzedAt)));

        return new Set(rows.map(row => row.id));
    }

    /**
     * 카드 표시에 필요한 컬럼만 최신순으로 읽어 로케일에 맞게 현지화한다.
     *
     * `listBySymbol`과의 차이는 집계 경로가 쓰는 `symbol`/`analyzedAt`을 싣느냐뿐이다
     * (둘 다 `bodyEn`은 읽지 않는다). 3초 폴링(`getNewsCardsAction`)과 목록 렌더는 그 둘도
     * 안 쓰므로 180일 창 × 수백 행에서 그만큼을 덜 실어 나른다. 시장 뉴스 슬라이스도 같은
     * 투영을 SELECT 단계에 두고 있다(`listCardsByCategory`).
     */
    async listCardsBySymbol(
        symbol: string,
        sinceMs: number,
        locale: Locale
    ): Promise<NewsDisplayItem[]> {
        const rows = await this.db
            .select({
                id: news.id,
                source: news.source,
                url: news.url,
                publishedAt: news.publishedAt,
                titleEn: news.titleEn,
                titleKo: news.titleKo,
                bodyKo: news.bodyKo,
                summaryKo: news.summaryKo,
                sentiment: news.sentiment,
                category: news.category,
                priceImpact: news.priceImpact,
            })
            .from(news)
            .where(inWindow(symbol, sinceMs))
            .orderBy(...NEWEST_FIRST);

        return toLocalizedDisplayItems(rows, locale, TRANSLATABLE_ENTITY.news);
    }
}

/**
 * 종목 뉴스 목록을 카드 투영으로 읽는다. `React.cache`로 같은 요청 안의 동시 호출(예:
 * NewsPage 본문 + NewsListSection)을 dedup해 cache MISS 시 DB를 중복 조회하지 않는다.
 *
 * **scope**: React.cache는 단일 React 렌더 트리(= 단일 HTTP 요청) 안에서만 memoize한다.
 * /news와 /overall은 별개 HTTP 요청이라 scope를 공유하지 않는다 — 두 라우트 사이의 중복
 * 방지는 호출자별 `staticSymbolCache`(ISR cross-request 캐시)가 담당하고, 이 함수는 같은
 * 요청 안의 factory 동시 호출에 대한 backstop이다.
 *
 * 조회 창은 `NEWS_LOOKBACK_MS`로 고정이다. 호출자별로 다른 창이 필요해지면 별도 함수로
 * 분리해야 한다.
 *
 * DB I/O가 있으므로 `lib/`(순수 함수 전용, src/entities/CLAUDE.md#EN-1)가 아니라
 * `api.ts`에 둔다.
 */
export const getNewsList = cache(
    async (symbol: string, locale: Locale): Promise<NewsDisplayItem[]> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleNewsRepository(db);
        // 카드 투영으로 읽는다 — 이 함수의 소비자 셋(뉴스 목록, 뉴스 페이지 본문,
        // overall 페이지) 중 누구도 `bodyEn`/`symbol`/`analyzedAt`을 읽지 않는데,
        // 결과가 `staticSymbolCache`(=`unstable_cache`)로 S3 ISR 블롭에 굳는다.
        // 클라이언트 경계에서만 걸러 내면 Neon 전송과 S3 블롭에는 그대로 남는다.
        return repo.listCardsBySymbol(symbol, NEWS_LOOKBACK_MS, locale);
    }
);
