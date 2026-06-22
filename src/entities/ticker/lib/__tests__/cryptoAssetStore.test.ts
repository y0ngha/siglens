// vi.mock calls are hoisted by vitest above all imports — must appear before any import statements.
// Variables referenced in mock factories must be declared before vi.mock so they are in scope
// when vitest hoists the mocks to the top of the compiled module.

const mockFindBySymbol = vi.fn();
const mockSearch = vi.fn();
const mockFmpCryptoMembership = vi.fn();

// The `tryGetTickerDatabaseClient` return value drives `tryGetRepository()`.
// When null, the whole function returns null (no DB path). When non-null,
// DrizzleCryptoAssetRepository is constructed from the returned `.db` value.
// We mock both the db client AND the repository class so the class is never
// actually instantiated against a real drizzle DB in tests.
let mockDbClient: null | { db: unknown } = null;

vi.mock('../db', () => ({
    tryGetTickerDatabaseClient: () => mockDbClient,
}));

// Match the import path in cryptoAssetStore.ts so vitest intercepts the import.
// cryptoAssetStore.ts imports from '../api' (relative), which resolves to
// entities/ticker/api. From this test file (lib/__tests__/), the same module
// is reachable as '../../api'. Vitest resolves both to the same module, so
// mocking '../../api' correctly intercepts the source's '../api' import.
vi.mock('../../api', () => ({
    DrizzleCryptoAssetRepository: class MockRepo {
        findBySymbol(...args: unknown[]) {
            return mockFindBySymbol(...args);
        }
        search(...args: unknown[]) {
            return mockSearch(...args);
        }
    },
}));

// isCryptoSymbol now calls fmpCryptoMembership on every DB miss (and when
// DB is unavailable). We stub it here so tests don't hit the real Redis/FMP
// path (which imports 'server-only' and requires infra). Tests that need
// specific FMP behavior set the mock return value in the describe block.
vi.mock('../fmpCryptoMembership', () => ({
    fmpCryptoMembership: (...args: unknown[]) =>
        mockFmpCryptoMembership(...args),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    isCryptoSymbol,
    getCryptoAsset,
    searchCryptoAssets,
} from '../cryptoAssetStore';

describe('cryptoAssetStore (no DB)', () => {
    beforeEach(() => {
        mockFindBySymbol.mockReset();
        mockSearch.mockReset();
        mockFmpCryptoMembership.mockReset();
        mockDbClient = null;
    });

    it('isCryptoSymbol returns false when DB is unavailable and FMP-list misses', async () => {
        // No DB and the symbol is not in the FMP-list either → definitively non-crypto.
        mockFmpCryptoMembership.mockResolvedValue(null);
        expect(await isCryptoSymbol('BTCUSD_NODB')).toBe(false);
    });

    it('searchCryptoAssets returns [] when DB is unavailable', async () => {
        expect(await searchCryptoAssets('btc_nodb')).toEqual([]);
    });
});

describe('cryptoAssetStore (with DB)', () => {
    beforeEach(() => {
        mockFindBySymbol.mockReset();
        mockSearch.mockReset();
        mockFmpCryptoMembership.mockReset();
        mockDbClient = { db: {} };
    });

    describe('isCryptoSymbol — catch branch', () => {
        it('returns false and logs when repository.findBySymbol rejects', async () => {
            // Distinct symbol not yet in the module-level Map cache.
            mockFindBySymbol.mockRejectedValue(new Error('DB error'));
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = await isCryptoSymbol('ERRTEST_CATCH_ISOCR');

            expect(result).toBe(false);
            expect(warnSpy).toHaveBeenCalledWith(
                '[cryptoAssetStore] findBySymbol failed',
                expect.any(Error)
            );
            warnSpy.mockRestore();
        });
    });

    describe('getCryptoAsset — catch branch', () => {
        it('returns null and logs when repository.findBySymbol rejects', async () => {
            mockFindBySymbol.mockRejectedValue(new Error('DB error'));
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = await getCryptoAsset('ERRTEST_CATCH_GCACR');

            expect(result).toBeNull();
            expect(warnSpy).toHaveBeenCalledWith(
                '[cryptoAssetStore] getCryptoAsset failed',
                expect.any(Error)
            );
            warnSpy.mockRestore();
        });
    });

    describe('searchCryptoAssets — catch branch', () => {
        it('returns [] and logs a warning when repository.search throws', async () => {
            // Use a unique query so the search cache does not return a cached value.
            mockSearch.mockRejectedValue(new Error('DB error'));
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = await searchCryptoAssets('ERRTEST_CATCH_SCA');

            expect(result).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                '[cryptoAssetStore] search failed',
                expect.any(Error)
            );
            warnSpy.mockRestore();
        });
    });

    describe('isCryptoSymbol — DB available, symbol absent (S2)', () => {
        it('returns false and caches the result when findBySymbol resolves null and FMP-list misses', async () => {
            // A unique symbol that has never entered the module-level cache before.
            // The suffix _S2_TEST is intentionally verbose so cache bleed from
            // other tests is impossible even if the module cache is not cleared
            // between describe blocks (module-level Maps persist across tests).
            //
            // New contract: DB miss alone is no longer enough to classify as
            // non-crypto — isCryptoSymbol also checks fmpCryptoMembership. Only
            // after both miss does it cache and return false. (Previously the
            // old "negatives-only" contract cached false on DB miss alone, which
            // caused the cache-pollution bug fixed in this branch.)
            mockFindBySymbol.mockResolvedValue(null);
            mockFmpCryptoMembership.mockResolvedValue(null);

            // First call: DB miss + FMP-list miss → false.
            const first = await isCryptoSymbol('NOTACRYPTO_S2_TEST');
            expect(first).toBe(false);
            expect(mockFindBySymbol).toHaveBeenCalledTimes(1);
            expect(mockFmpCryptoMembership).toHaveBeenCalledTimes(1);

            // Second call: result must be served from the module-level cache —
            // no additional DB or FMP-list round-trip.
            const second = await isCryptoSymbol('NOTACRYPTO_S2_TEST');
            expect(second).toBe(false);
            expect(mockFindBySymbol).toHaveBeenCalledTimes(1);
            expect(mockFmpCryptoMembership).toHaveBeenCalledTimes(1);
        });
    });

    describe('isCryptoSymbol — cache hit', () => {
        it('returns cached value without hitting DB again for same symbol', async () => {
            mockFindBySymbol.mockResolvedValue({
                symbol: 'CACHEHIT_CACHE_ISOCR',
                name: 'Cache Hit Coin',
                koreanName: null,
                circulatingSupply: null,
            });

            // First call populates the module-level cache.
            const first = await isCryptoSymbol('CACHEHIT_CACHE_ISOCR');
            expect(first).toBe(true);
            expect(mockFindBySymbol).toHaveBeenCalledTimes(1);

            // Second call reads from the module-level cache — no additional DB call.
            const second = await isCryptoSymbol('CACHEHIT_CACHE_ISOCR');
            expect(second).toBe(true);
            expect(mockFindBySymbol).toHaveBeenCalledTimes(1);
        });
    });

    describe('getCryptoAsset — cache primes isCryptoSymbol', () => {
        it('getCryptoAsset result primes the symbol cache', async () => {
            const record = {
                symbol: 'PRIMETEST_CACHE_GCACR',
                name: 'Prime Coin',
                koreanName: null,
                circulatingSupply: null,
            };
            mockFindBySymbol.mockResolvedValue(record);

            const asset = await getCryptoAsset('PRIMETEST_CACHE_GCACR');
            expect(asset).toEqual(record);

            // isCryptoSymbol should use the cache seeded by getCryptoAsset — no extra DB call.
            const isCrypto = await isCryptoSymbol('PRIMETEST_CACHE_GCACR');
            expect(isCrypto).toBe(true);
            expect(mockFindBySymbol).toHaveBeenCalledTimes(1);
        });
    });

    describe('searchCryptoAssets — cache hit', () => {
        it('second call with the same query does not re-query the DB', async () => {
            const record = {
                symbol: 'SEARCHCACHEHIT_SCA',
                name: 'Search Cache Hit Coin',
                koreanName: null,
                circulatingSupply: null,
            };
            mockSearch.mockResolvedValue([record]);

            // First call — should hit the DB.
            const first = await searchCryptoAssets('searchcachehit_sca');
            expect(mockSearch).toHaveBeenCalledTimes(1);

            // Second call with the same query — should read from the module-level cache.
            const second = await searchCryptoAssets('searchcachehit_sca');
            expect(mockSearch).toHaveBeenCalledTimes(1);

            // Both calls return the same results.
            expect(second).toEqual(first);
        });
    });
});
