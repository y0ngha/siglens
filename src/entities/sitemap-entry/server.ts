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
