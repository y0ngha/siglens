import 'server-only';

import { unstable_cache } from 'next/cache';

import { APPROVED_LONGTAIL_TICKERS } from '@/entities/symbol-indexability';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleRemovalSitemapCandidateSource } from './api';
import { buildRemovalEntries } from './lib/buildRemovalEntries';
import {
    REMOVAL_CHART_CUTOFF_ISO,
    REMOVAL_CRYPTO_LIMIT,
    REMOVAL_LEGACY_TAB_CUTOFF_ISO,
    type RemovalSitemapEntry,
    type RemovalSitemapKind,
} from './model';

const REMOVAL_SITEMAP_CACHE_KEY_PREFIX = 'temporary-removal-sitemap:v1';

const protectedSymbols: readonly string[] = Object.freeze([
    ...new Set([
        ...POPULAR_TICKERS,
        ...POPULAR_CRYPTOS,
        ...APPROVED_LONGTAIL_TICKERS,
    ]),
]);

function cutoffIsoFor(kind: RemovalSitemapKind): string {
    return kind === 'chart'
        ? REMOVAL_CHART_CUTOFF_ISO
        : REMOVAL_LEGACY_TAB_CUTOFF_ISO;
}

async function loadUncached(
    kind: RemovalSitemapKind
): Promise<RemovalSitemapEntry[]> {
    const source = new DrizzleRemovalSitemapCandidateSource(
        getDatabaseClient().db
    );
    const stockSymbolsPromise = source.loadStockSymbolsBefore(
        new Date(cutoffIsoFor(kind)),
        protectedSymbols
    );

    if (kind !== 'chart') {
        const stockSymbols = await stockSymbolsPromise;
        return buildRemovalEntries(kind, stockSymbols);
    }

    const [stockSymbols, cryptoSymbols] = await Promise.all([
        stockSymbolsPromise,
        source.loadHistoricalCryptoSymbols(
            REMOVAL_CRYPTO_LIMIT,
            protectedSymbols
        ),
    ]);

    return buildRemovalEntries(kind, [...stockSymbols, ...cryptoSymbols]);
}

export async function loadRemovalSitemapEntries(
    kind: RemovalSitemapKind
): Promise<RemovalSitemapEntry[]> {
    const cutoffIso = cutoffIsoFor(kind);
    const cacheKey = `${REMOVAL_SITEMAP_CACHE_KEY_PREFIX}:${kind}:${cutoffIso}`;

    return unstable_cache(() => loadUncached(kind), [cacheKey], {
        revalidate: false,
    })();
}
