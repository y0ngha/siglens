import 'server-only';

import { unstable_cache } from 'next/cache';

import { APPROVED_LONGTAIL_TICKERS } from '@/entities/symbol-indexability';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { getDatabaseClient } from '@/shared/db/client';

import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api';
import { DrizzleTermsRepository } from '@/entities/terms';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { TERMS_KIND_VALUES, type TermsKind } from '@/shared/db/constants';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

import { DrizzleRemovalSitemapCandidateSource } from './api';
import type { BuildStaticEntriesOptions } from './lib/buildStaticEntries';
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

const STATIC_SITEMAP_INPUT_CACHE_KEY = 'static-sitemap-inputs:v1';

/**
 * sitemap의 lastmod를 **요청 시각이 아니라 콘텐츠의 갱신 시각**으로 만들기 위한
 * DB 읽기. 순수 빌더(`buildStaticEntries`)는 I/O를 하지 않으므로 여기서 읽어
 * 옵션으로 넘긴다.
 *
 * 실패하면 부분 결과(또는 빈 객체)를 돌려준다 — 빌더가 `SITE_BUILD_DATE`/UTC 일
 * 경계로 폴백하므로 sitemap 자체는 계속 나간다. sitemap을 500으로 떨어뜨리는 것보다
 * lastmod 한 칸이 덜 정확한 편이 낫다.
 *
 * 한 시간 캐시: 두 sitemap 라우트(index + static)가 같은 값을 쓰고, 뉴스 인제스션
 * 주기보다 잦게 읽을 이유가 없다.
 */
async function loadUncachedStaticSitemapInputs(): Promise<BuildStaticEntriesOptions> {
    const { db } = getDatabaseClient();
    const [newsLatestPublishedAt, legalEffectiveDates] = await Promise.all([
        loadNewsLatestPublishedAt(db),
        loadLegalEffectiveDates(db),
    ]);
    return { newsLatestPublishedAt, legalEffectiveDates };
}

type DatabaseClient = ReturnType<typeof getDatabaseClient>['db'];

async function loadNewsLatestPublishedAt(
    db: DatabaseClient
): Promise<Partial<Record<NewsFeedCategoryId, Date>>> {
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig> — Object.keys is exactly the union.
    const categories = Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[];
    try {
        const bySentinel = await new DrizzleMarketNewsRepository(
            db
        ).listLatestPublishedAt(
            categories.map(cat => CATEGORY_CONFIG[cat].sentinel)
        );
        return Object.fromEntries(
            categories.flatMap(cat => {
                const latest = bySentinel.get(CATEGORY_CONFIG[cat].sentinel);
                return latest === undefined ? [] : [[cat, latest] as const];
            })
        );
    } catch (error) {
        console.error('[staticSitemapInputs] news publishedAt failed:', error);
        return {};
    }
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

export async function loadStaticSitemapInputs(): Promise<BuildStaticEntriesOptions> {
    try {
        return await unstable_cache(
            loadUncachedStaticSitemapInputs,
            [STATIC_SITEMAP_INPUT_CACHE_KEY],
            { revalidate: SECONDS_PER_HOUR }
        )();
    } catch (error) {
        console.error('[staticSitemapInputs] load failed:', error);
        return {};
    }
}
