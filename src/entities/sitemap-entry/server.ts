import 'server-only';

import { unstable_cache } from 'next/cache';

import { APPROVED_LONGTAIL_TICKERS } from '@/entities/symbol-indexability/config/approved-longtail-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { getDatabaseClient } from '@/shared/db/client';

import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api/marketNewsRepository';
import { DrizzleTermsRepository } from '@/entities/terms/api';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { SNAPSHOT_MAX_AGE_MS } from '@/entities/seo-snapshot/model';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { TERMS_KIND_VALUES, type TermsKind } from '@/shared/db/constants';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

import { DrizzleRemovalSitemapCandidateSource } from './api';
import type { BuildStaticEntriesOptions } from './lib/buildStaticEntries';
import {
    PROSE_GATED_SITEMAP_TABS,
    snapshotKey,
    type BuildPopularEntriesOptions,
    type ProseGatedSitemapTab,
} from './lib/proseGate';
import { buildRemovalEntries } from './lib/buildRemovalEntries';
import {
    REMOVAL_CHART_CUTOFF_ISO,
    REMOVAL_CRYPTO_LIMIT,
    REMOVAL_LEGACY_TAB_CUTOFF_ISO,
    type RemovalSitemapEntry,
    type RemovalSitemapKind,
} from './model';

const REMOVAL_SITEMAP_CACHE_KEY_PREFIX = 'temporary-removal-sitemap:v1';

const protectedSymbolSet = new Set(
    [...POPULAR_TICKERS, ...POPULAR_CRYPTOS, ...APPROVED_LONGTAIL_TICKERS].map(
        symbol => symbol.toUpperCase()
    )
);
const protectedSymbols: readonly string[] = [...protectedSymbolSet].toSorted();

function cutoffIsoFor(kind: RemovalSitemapKind): string {
    return kind === 'chart'
        ? REMOVAL_CHART_CUTOFF_ISO
        : REMOVAL_LEGACY_TAB_CUTOFF_ISO;
}

function excludeProtectedSymbols(symbols: readonly string[]): string[] {
    return symbols.filter(
        symbol => !protectedSymbolSet.has(symbol.toUpperCase())
    );
}

async function loadUncachedSymbols(
    kind: RemovalSitemapKind
): Promise<string[]> {
    const source = new DrizzleRemovalSitemapCandidateSource(
        getDatabaseClient().db
    );
    const stockSymbolsPromise = source.loadStockSymbolsBefore(
        new Date(cutoffIsoFor(kind)),
        protectedSymbols
    );

    if (kind !== 'chart') {
        const stockSymbols = await stockSymbolsPromise;
        return excludeProtectedSymbols(stockSymbols);
    }

    const [stockSymbols, cryptoSymbols] = await Promise.all([
        stockSymbolsPromise,
        source.loadHistoricalCryptoSymbols(
            REMOVAL_CRYPTO_LIMIT,
            protectedSymbols
        ),
    ]);

    return excludeProtectedSymbols([...stockSymbols, ...cryptoSymbols]);
}

export async function loadRemovalSitemapEntries(
    kind: RemovalSitemapKind
): Promise<RemovalSitemapEntry[]> {
    const cutoffIso = cutoffIsoFor(kind);
    const cacheKey = `${REMOVAL_SITEMAP_CACHE_KEY_PREFIX}:${kind}:${cutoffIso}`;

    const symbols = await unstable_cache(
        () => loadUncachedSymbols(kind),
        [cacheKey],
        {
            revalidate: false,
        }
    )();

    return buildRemovalEntries(kind, symbols);
}

// 뉴스·약관은 **별도 캐시 항목**이다. 한 항목에 묶으면 뉴스 조회 실패를 안쪽에서 삼켜
// `{}`로 저장하게 되고(1시간 굳음), 그 `{}`는 "기사 0건"과 구별되지 않는다.
const STATIC_SITEMAP_NEWS_CACHE_KEY = 'static-sitemap-news-latest:v1';
const STATIC_SITEMAP_LEGAL_CACHE_KEY = 'static-sitemap-legal-dates:v1';

/**
 * sitemap의 lastmod를 **요청 시각이 아니라 콘텐츠의 갱신 시각**으로 만들기 위한
 * DB 읽기. 순수 빌더(`buildStaticEntries`)는 I/O를 하지 않으므로 여기서 읽어
 * 옵션으로 넘긴다.
 *
 * 실패하면 그 입력만 빠진 옵션을 돌려준다 — 빌더가 `SITE_BUILD_DATE`/UTC 일
 * 경계로 폴백하고 뉴스 카테고리는 전부 싣는다(fail-open). 그래서 sitemap 자체는 계속 나간다.
 * sitemap을 500으로 떨어뜨리는 것보다 lastmod 한 칸이 덜 정확한 편이 낫다.
 *
 * **실패를 캐시에 넣지 않는다.** 읽기 실패는 `unstable_cache` 콜백 안에서 **throw**하고
 * 바깥(`loadNewsLatestPublishedAt`)에서 잡는다 — 안쪽에서 `{}`로 삼키면 그 `{}`가 한 시간 저장되고,
 * 빌더는 그것을 "로더 성공, 기사 0건"으로 읽어 모든 뉴스 카테고리를 sitemap에서 뺀다.
 * 던지면 저장을 건너뛰고(stale 엔트리가 있으면 그 값을 돌려준다), 바깥 catch가 `undefined`
 * ("모름")를 돌려준다.
 *
 * 한 시간 캐시: 두 sitemap 라우트(index + static)가 같은 값을 쓰고, 뉴스 인제스션
 * 주기보다 잦게 읽을 이유가 없다.
 */
/**
 * `unstable_cache`가 반환값을 JSON으로 직렬화하므로, 여기서 넘기는 `Date`는
 * 캐시를 한 번 거치면 ISO 문자열로 돌아온다. 그 계약을 타입으로 명시해
 * 캐시 경계 너머(`loadStaticSitemapInputs`)에서만 다시 `Date`로 복원한다 —
 * 그렇지 않으면 `buildStaticEntries`가 문자열에 `.getTime()`을 불러 죽는다
 * (`maxLastModified`의 reduce에서 `TypeError: r.getTime is not a function`).
 */
type SerializedNewsLatest = Partial<Record<NewsFeedCategoryId, string>>;
type SerializedLegalDates = Partial<Record<TermsKind, string>>;

function toIsoRecord<K extends string>(
    record: Partial<Record<K, Date>>
): Partial<Record<K, string>> {
    return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
            key,
            (value as Date).toISOString(),
        ])
    ) as Partial<Record<K, string>>;
}

function fromIsoRecord<K extends string>(
    record: Partial<Record<K, string>>
): Partial<Record<K, Date>> {
    return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
            key,
            new Date(value as string),
        ])
    ) as Partial<Record<K, Date>>;
}

type DatabaseClient = ReturnType<typeof getDatabaseClient>['db'];

/** 실패하면 throw한다(캐시에 `{}`를 굳히지 않으려고). 호출부가 바깥에서 잡는다. */
async function loadUncachedNewsLatestPublishedAt(): Promise<SerializedNewsLatest> {
    const { db } = getDatabaseClient();
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig> — Object.keys is exactly the union.
    const categories = Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[];
    const bySentinel = await new DrizzleMarketNewsRepository(
        db
    ).listLatestPublishedAt(
        categories.map(cat => CATEGORY_CONFIG[cat].sentinel)
    );
    return toIsoRecord(
        Object.fromEntries(
            categories.flatMap(cat => {
                const latest = bySentinel.get(CATEGORY_CONFIG[cat].sentinel);
                return latest === undefined ? [] : [[cat, latest] as const];
            })
        ) as Partial<Record<NewsFeedCategoryId, Date>>
    );
}

async function loadUncachedLegalEffectiveDates(): Promise<SerializedLegalDates> {
    const { db } = getDatabaseClient();
    return toIsoRecord(await loadLegalEffectiveDates(db));
}

async function loadLegalEffectiveDates(
    db: DatabaseClient
): Promise<Partial<Record<TermsKind, Date>>> {
    const repo = new DrizzleTermsRepository(db);
    // 본문은 로케일별로 갈리지만 발효일은 갈리지 않는다 — 기본 로케일로 한 번만 읽는다.
    const rows = await Promise.all(
        TERMS_KIND_VALUES.map(kind =>
            repo.findActive(kind, DEFAULT_LOCALE).catch((error: unknown) => {
                console.error(
                    `[staticSitemapInputs] terms(${kind}) failed:`,
                    error
                );
                return null;
            })
        )
    );
    return Object.fromEntries(
        rows.flatMap((row, index) =>
            row === null
                ? []
                : [[TERMS_KIND_VALUES[index]!, row.effectiveDate] as const]
        )
    );
}

/** `undefined` = 모름(읽기 실패). `{}`는 "기사가 하나도 없음"이라는 성공 결과다. */
async function loadNewsLatestPublishedAt(): Promise<
    Partial<Record<NewsFeedCategoryId, Date>> | undefined
> {
    try {
        const serialized = await unstable_cache(
            loadUncachedNewsLatestPublishedAt,
            [STATIC_SITEMAP_NEWS_CACHE_KEY],
            { revalidate: SECONDS_PER_HOUR }
        )();
        return fromIsoRecord(serialized);
    } catch (error) {
        console.error('[staticSitemapInputs] news publishedAt failed:', error);
        return undefined;
    }
}

async function loadLegalDates(): Promise<
    Partial<Record<TermsKind, Date>> | undefined
> {
    try {
        const serialized = await unstable_cache(
            loadUncachedLegalEffectiveDates,
            [STATIC_SITEMAP_LEGAL_CACHE_KEY],
            { revalidate: SECONDS_PER_HOUR }
        )();
        return fromIsoRecord(serialized);
    } catch (error) {
        console.error('[staticSitemapInputs] legal dates failed:', error);
        return undefined;
    }
}

export async function loadStaticSitemapInputs(): Promise<BuildStaticEntriesOptions> {
    const [newsLatestPublishedAt, legalEffectiveDates] = await Promise.all([
        loadNewsLatestPublishedAt(),
        loadLegalDates(),
    ]);
    return {
        ...(newsLatestPublishedAt !== undefined && { newsLatestPublishedAt }),
        ...(legalEffectiveDates !== undefined && { legalEffectiveDates }),
    };
}

// v2: 값 형식이 `string[]`(키 목록)에서 `{ snapshotGeneratedAt }`로 바뀌었다 — 옛 항목을
// 새 코드가 읽으면 `serialized.snapshotGeneratedAt`이 undefined라 죽는다.
const POPULAR_SITEMAP_INPUT_CACHE_KEY = 'popular-sitemap-inputs:v2';

/**
 * `unstable_cache`가 반환값을 JSON으로 직렬화하므로 `Date`는 캐시를 거치면 ISO
 * 문자열로 돌아온다 — `SerializedStaticSitemapInputs`와 같은 계약이다. `Map`도 JSON에서
 * `{}`로 깨지므로 `[키, ISO]` 쌍 배열로 넘기고, 캐시 경계 너머(`loadPopularSitemapInputs`)에서만
 * `Map<string, Date>`로 복원한다. 복원하지 않으면 빌더가 문자열에 `.getTime()`을 불러 죽는다.
 */
interface SerializedPopularSitemapInputs {
    readonly snapshotGeneratedAt: ReadonlyArray<readonly [string, string]>;
}

async function loadUncachedPopularSitemapInputs(): Promise<SerializedPopularSitemapInputs> {
    const rows = await new DrizzleSeoSnapshotRepository(
        getDatabaseClient().db
    ).listFreshSymbolTabs(
        PROSE_GATED_SITEMAP_TABS,
        DEFAULT_LOCALE,
        new Date(Date.now() - SNAPSHOT_MAX_AGE_MS)
    );
    return {
        snapshotGeneratedAt: rows
            // 렌더 가능한 산문이 없는 행은 맵에 넣지 않는다 — 키가 곧 "페이지가 색인 대상"이다.
            .filter(row => row.hasProse)
            .map(
                row =>
                    [
                        // safe: 쿼리가 `PROSE_GATED_SITEMAP_TABS`로 거른 행이다.
                        snapshotKey(
                            row.symbol,
                            row.tab as ProseGatedSitemapTab
                        ),
                        row.generatedAt.toISOString(),
                    ] as const
            ),
    };
}

/**
 * 종목 sitemap의 두 입력을 **한 번의 쿼리**로 읽는다:
 *  1. 산문 게이트 — 렌더 가능한 스냅샷 산문이 없으면 페이지가 noindex인 탭(차트·뉴스 —
 *     각 `page.tsx` generateMetadata의 `prose: absent`)을 산문 보유 종목에만 싣는다. 키가
 *     있으면 그 조합은 신선하고 **`hasProseForTab`(렌더러·페이지와 같은 판정)을 통과한다.**
 *     행이 존재하는지만 보면 서사 필드가 빈 행이 sitemap에는 실리고 페이지는 noindex가 된다.
 *     (예전: congress 108·overall 49개가 "sitemap에 있는데 noindex" — 2026-09-17 운영 크롤.)
 *  2. lastmod — 같은 행의 `generatedAt`(`technical`·`news`). 뉴스 탭은 그 시각을,
 *     차트 탭은 세션 마감과 겨뤄 늦은 쪽을 광고한다(2026-10-04 2차 정직화).
 * 둘 다 {@link PROSE_GATED_SITEMAP_TABS} 행에서 나오므로 쿼리가 하나이고 판정이 갈리지
 * 않는다. 페이지 게이트와 같은 신선도 상한(`SNAPSHOT_MAX_AGE_MS`)을 쓴다. 본문 전체는 읽지
 * 않고 산문 원천 필드만 SQL에서 투영한다(`listFreshSymbolTabs`).
 *
 * **실패하면 필터를 끈다**(`{}`) — 스냅샷을 못 읽었다고 sitemap에서 수백 URL을
 * 빼는 것보다, 전부 싣는 편이 안전하다(lastmod도 폴백). 페이지도 읽기 실패(`unknown`)에는
 * 색인을 유지하므로 같은 방향이다. 한 시간 캐시: 프리웜은 하룻밤에 한 바퀴라 그보다 자주
 * 읽을 이유가 없다. 실패는 캐시 콜백 **안**에서 throw되어 저장되지 않는다.
 */
export async function loadPopularSitemapInputs(): Promise<BuildPopularEntriesOptions> {
    try {
        const serialized = await unstable_cache(
            loadUncachedPopularSitemapInputs,
            [POPULAR_SITEMAP_INPUT_CACHE_KEY],
            { revalidate: SECONDS_PER_HOUR }
        )();
        return {
            snapshotGeneratedAt: new Map(
                serialized.snapshotGeneratedAt.map(
                    ([key, iso]) => [key, new Date(iso)] as const
                )
            ),
        };
    } catch (error) {
        console.error('[popularSitemapInputs] load failed:', error);
        return {};
    }
}
