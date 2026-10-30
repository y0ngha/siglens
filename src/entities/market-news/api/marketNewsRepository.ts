import 'server-only';
import { cache } from 'react';
import {
    and,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    max,
    sql,
    type SQL,
} from 'drizzle-orm';
import type { NewsCardAnalysis } from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { TRANSLATABLE_ENTITY } from '@/shared/db/contentTranslationFields';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { marketNews } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { toLocalizedDisplayItems } from '@/shared/lib/news/toLocalizedDisplayItems';
import { withRetry } from '@/shared/lib/withRetry';
import { dropSolicitations } from '../lib/dropSolicitations';
import type { MarketNewsItem } from '../lib/marketNewsClientPort';
import { MARKET_NEWS_LOOKBACK_MS } from '../lib/marketNewsConstants';
import { toMarketNewsRow } from '../lib/toMarketNewsRow';
import type { MarketNewsCardItem } from '../lib/toCardItem';
import type { MarketNewsRow } from '../model';

/** 센티널 버킷의 조회 창(`cutoff` 이후 발행) 조건. 목록·카드 읽기가 공유한다. */
function inBucketWindow(sentinel: string, cutoff: Date): SQL | undefined {
    return and(
        eq(marketNews.symbol, sentinel),
        gte(marketNews.publishedAt, cutoff)
    );
}

/**
 * 최신순 정렬 + 동률 tie-break. `/news/[category]`가 앞에서 N개를 잘라 쓰므로 같은
 * 시각 행들의 상대 순서가 정해지지 않으면 경계에 걸친 행이 재생성마다 바뀌어 ISR
 * 블롭이 흔들린다.
 */
const NEWEST_FIRST = [desc(marketNews.publishedAt), desc(marketNews.id)];

/**
 * `market_news` 테이블 접근. 적재 경로(`ingestMarketNewsCategory`)와 읽기 경로
 * (`getMarketNewsList` / `getMarketNewsCards`)가 공유한다. 모든 쿼리는 일시적 DB 오류에
 * 한해 재시도한다(`DB_TRANSIENT_RETRY`).
 */
export class DrizzleMarketNewsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 기사를 upsert하고, 행이 실제로 새로 들어갔거나 내용이 바뀌었는지 돌려준다.
     * 재수신한 내용이 같으면 `false`라 호출부가 `revalidateTag`를 건너뛸 수 있다.
     *
     * 피드끼리 URL이 겹치지 않으므로 `id = hashUrlToId(url)`만으로 충분하다 —
     * 복합 id가 필요 없다. 충돌 시 `set`은 `symbol`을 **의도적으로 제외**한다: 먼저
     * 쓴 쪽이 버킷을 차지하고, 카테고리 적재가 다른 버킷의 행을 가져오지 못하게 한다.
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
                     * `symbol`은 `set`과 `setWhere` 둘 다에서 의도적으로 뺀다 — 버킷
                     * 센티널은 첫 insert에서 고정되므로 동시 카테고리 적재가 기사를
                     * 버킷 사이로 옮길 수 없다.
                     *
                     * 분석 컬럼(titleKo/bodyKo/summaryKo/sentiment/category/
                     * priceImpact/analyzedAt)은 `attachAnalysis()`로 한 번만 쓰이며,
                     * LLM 번역 결과를 지키려고 `set`에서도 뺀다.
                     *
                     * `setWhere IS DISTINCT FROM` + `.returning({id})`이라 내용이
                     * 실제로 바뀐 경우에만 UPDATE가 나가고, 호출부는 바뀌지 않았을 때
                     * `revalidateTag`를 건너뛴다.
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
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    /**
     * 기존 행에 LLM 분석을 붙인다. DB 층에서 write-once다: UPDATE가
     * `analyzedAt IS NULL`로 거르므로 동시에 온 두 번째 쓰기는 덮어쓰지 않고 no-op이 된다.
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
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 센티널 버킷에서 `sinceMs` 안에 발행된 기사를 최신순으로 읽는다. 로펌 원고 모집
     * 광고(`dropSolicitations`)는 숨긴다.
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
                    .where(inBucketWindow(sentinel, cutoff))
                    .orderBy(...NEWEST_FIRST),
            DB_TRANSIENT_RETRY
        );

        return dropSolicitations(rows).map(toMarketNewsRow);
    }

    /**
     * 카드 표시에 필요한 컬럼만 읽는다 — `bodyEn`을 select에서 뺀다.
     *
     * 3초 폴링과 목록 렌더는 본문을 받아서 버린다. 받은 **뒤** 거르면 Neon 전송과
     * S3 ISR 블롭에는 그대로 남으므로 투영은 SELECT가 한다(종목 뉴스의
     * `listCardsBySymbol`과 같은 이유). `listByCategory`와의 차이는 `symbol`/
     * `analyzedAt` 유무뿐이고 필터·정렬·창은 같다.
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
                    .where(inBucketWindow(sentinel, cutoff))
                    .orderBy(...NEWEST_FIRST),
            DB_TRANSIENT_RETRY
        );

        // 거른 **뒤** 지역화한다 — `visibleRows[index]`로 tickers를 되붙이므로 두 배열의
        // 길이·순서가 같아야 한다.
        const visibleRows = dropSolicitations(rows);

        // 카드 투영·해석은 종목 뉴스와 같은 함수를 쓴다 — 컬럼도 소비자도
        // 같은데 슬라이스마다 따로 구현하면 한쪽만 고쳐진다.
        const localized = await toLocalizedDisplayItems(
            visibleRows,
            locale,
            TRANSLATABLE_ENTITY.marketNews
        );
        return localized.map((item, index) => ({
            ...item,
            tickers: visibleRows[index]!.tickers,
        }));
    }

    /**
     * 센티널 버킷별 **최신 기사 `publishedAt`**. sitemap의 news lastmod가 유일한
     * 소비자다 — 행을 받아 와서 최댓값을 고르면 7일치를 통째로 전송하게 되므로
     * 집계를 SQL로 내린다(`listCardsByCategory`가 컬럼을 줄인 것과 같은 이유).
     *
     * 발표가 없는 버킷은 결과에서 빠진다(빈 `MAX`는 행 자체가 없다).
     *
     * **로펌 원고 모집 광고(`isLawFirmSolicitation`)는 거르지 않는다.** 읽기 경로는 화면에서
     * 그 행을 숨기지만 이 `MAX`는 숨겨진 행의 시각도 포함하므로, 광고가 가장 최신이면
     * sitemap `lastmod`가 실제 노출 기사보다 앞설 수 있다. 받아들이는 이유: lastmod는
     * 힌트일 뿐이고 어긋나도 해가 없으며(크롤러가 한 번 더 들를 뿐), 거르려면 정규식을
     * SQL로 내리거나 행을 받아 와야 해서 이 집계를 둔 목적(전송량 절감)과 충돌한다.
     */
    async listLatestPublishedAt(
        sentinels: readonly string[]
    ): Promise<Map<string, Date>> {
        if (sentinels.length === 0) return new Map();

        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        symbol: marketNews.symbol,
                        latest: max(marketNews.publishedAt),
                    })
                    .from(marketNews)
                    .where(inArray(marketNews.symbol, [...sentinels]))
                    .groupBy(marketNews.symbol),
            DB_TRANSIENT_RETRY
        );

        return new Map(
            rows.flatMap(row =>
                row.latest === null ? [] : [[row.symbol, row.latest] as const]
            )
        );
    }

    /**
     * 이 창에서 이미 분석된 기사 id만 읽는다 — 필터를 SQL로 내려 id만 오게 한다
     * (종목 뉴스 `listAnalyzedIds`와 대칭).
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
                            inBucketWindow(sentinel, cutoff),
                            isNotNull(marketNews.analyzedAt)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );

        return new Set(rows.map(row => row.id));
    }
}

/**
 * 카드 표시용 목록(`React.cache`로 한 요청 안에서 메모이즈).
 *
 * 같은 렌더 트리·같은 Server Action 호출 안의 동시 호출을 합친다. 요청 간 캐싱은
 * 페이지 레이어(`staticSymbolCache` / `unstable_cache`)가 맡는다. 창은
 * `MARKET_NEWS_LOOKBACK_MS`(7일).
 *
 * `getMarketNewsList`와의 차이는 `symbol`/`analyzedAt` 유무뿐이다 — 둘 다 본문
 * (`body_en`)을 읽지 않는다(`toMarketNewsRow` 참조).
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

/**
 * 다이제스트 입력·집계·sitemap용 센티널 버킷 목록(`React.cache`로 한 요청 안에서
 * 메모이즈). 창은 `MARKET_NEWS_LOOKBACK_MS`(7일).
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
