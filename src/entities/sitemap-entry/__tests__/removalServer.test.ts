import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APPROVED_LONGTAIL_TICKERS } from '@/entities/symbol-indexability';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';

const mocks = vi.hoisted(() => ({
    unstableCache: vi.fn(
        (loader: () => Promise<unknown>) => async (): Promise<unknown> => {
            const result = await loader();
            return JSON.parse(JSON.stringify(result)) as unknown;
        }
    ),
    getDatabaseClient: vi.fn(() => ({ db: { name: 'database' } })),
    adapterConstructor: vi.fn(),
    loadStockSymbolsBefore: vi.fn(),
    loadHistoricalCryptoSymbols: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: mocks.unstableCache,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mocks.getDatabaseClient,
}));
vi.mock('../api', () => ({
    DrizzleRemovalSitemapCandidateSource: class {
        constructor(db: unknown) {
            mocks.adapterConstructor(db);
        }

        loadStockSymbolsBefore = mocks.loadStockSymbolsBefore;
        loadHistoricalCryptoSymbols = mocks.loadHistoricalCryptoSymbols;
    },
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import {
    REMOVAL_CHART_CUTOFF_ISO,
    REMOVAL_CRYPTO_LIMIT,
    REMOVAL_LEGACY_TAB_CUTOFF_ISO,
    type RemovalSitemapKind,
} from '../model';
import { loadRemovalSitemapEntries } from '../server';

const LEGACY_KINDS = [
    'news',
    'overall',
    'fundamental',
    'fear-greed',
] as const satisfies readonly RemovalSitemapKind[];

const expectedProtectedSymbols = [
    ...new Set(
        [
            ...POPULAR_TICKERS,
            ...POPULAR_CRYPTOS,
            ...APPROVED_LONGTAIL_TICKERS,
        ].map(symbol => symbol.toUpperCase())
    ),
].toSorted();

describe('loadRemovalSitemapEntries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.loadStockSymbolsBefore.mockResolvedValue([]);
        mocks.loadHistoricalCryptoSymbols.mockResolvedValue([]);
    });

    describe('when loading the chart removal sitemap', () => {
        it('merges stock and crypto candidates into sorted deduplicated URLs', async () => {
            mocks.loadStockSymbolsBefore.mockResolvedValue(['AAA', 'BTCUSD']);
            mocks.loadHistoricalCryptoSymbols.mockResolvedValue([
                'BTCUSD',
                'ZZZUSD',
            ]);

            const entries = await loadRemovalSitemapEntries('chart');

            expect(entries.map(entry => entry.url)).toEqual([
                'https://siglens.io/AAA',
                'https://siglens.io/ZZZUSD',
            ]);
            expect(mocks.getDatabaseClient).toHaveBeenCalledOnce();
            expect(mocks.adapterConstructor).toHaveBeenCalledWith({
                name: 'database',
            });
            expect(mocks.loadStockSymbolsBefore).toHaveBeenCalledWith(
                new Date(REMOVAL_CHART_CUTOFF_ISO),
                expectedProtectedSymbols
            );
            expect(mocks.loadHistoricalCryptoSymbols).toHaveBeenCalledWith(
                REMOVAL_CRYPTO_LIMIT,
                expectedProtectedSymbols
            );
        });

        it('rebuilds Date values after the cached symbol payload is JSON round-tripped', async () => {
            mocks.loadStockSymbolsBefore.mockResolvedValue(['AAA']);

            const entries = await loadRemovalSitemapEntries('chart');

            expect(entries).toHaveLength(1);
            expect(entries[0]?.lastModified).toBeInstanceOf(Date);
        });

        it('removes every protected symbol regardless of candidate casing', async () => {
            const protectedCandidates = expectedProtectedSymbols.map(symbol =>
                symbol.toLowerCase()
            );
            mocks.loadStockSymbolsBefore.mockResolvedValue(protectedCandidates);
            mocks.loadHistoricalCryptoSymbols.mockResolvedValue([
                'bTcUsD',
                'eThUsD',
            ]);

            const entries = await loadRemovalSitemapEntries('chart');

            expect(entries).toEqual([]);
        });

        it('uses the versioned kind and cutoff cache key without revalidation', async () => {
            await loadRemovalSitemapEntries('chart');

            expect(mocks.unstableCache).toHaveBeenCalledWith(
                expect.any(Function),
                ['temporary-removal-sitemap:v1:chart:2026-07-07T16:25:18.000Z'],
                { revalidate: false }
            );
        });
    });

    describe('when loading a legacy tab removal sitemap', () => {
        it.each(LEGACY_KINDS)(
            'loads only stock candidates for %s using the legacy cutoff',
            async kind => {
                await loadRemovalSitemapEntries(kind);

                expect(mocks.loadStockSymbolsBefore).toHaveBeenCalledWith(
                    new Date(REMOVAL_LEGACY_TAB_CUTOFF_ISO),
                    expectedProtectedSymbols
                );
                expect(
                    mocks.loadHistoricalCryptoSymbols
                ).not.toHaveBeenCalled();
                expect(mocks.unstableCache).toHaveBeenCalledWith(
                    expect.any(Function),
                    [
                        `temporary-removal-sitemap:v1:${kind}:${REMOVAL_LEGACY_TAB_CUTOFF_ISO}`,
                    ],
                    { revalidate: false }
                );
            }
        );
    });

    describe('when a candidate source rejects', () => {
        it('propagates the rejection', async () => {
            const sourceError = new Error('candidate query failed');
            mocks.loadStockSymbolsBefore.mockRejectedValue(sourceError);

            await expect(loadRemovalSitemapEntries('news')).rejects.toBe(
                sourceError
            );
        });
    });
});
