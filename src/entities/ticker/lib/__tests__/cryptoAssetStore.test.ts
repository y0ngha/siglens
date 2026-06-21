import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindBySymbol = vi.fn();
const mockSearch = vi.fn();

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

import {
    isCryptoSymbol,
    getCryptoAsset,
    searchCryptoAssets,
} from '../cryptoAssetStore';

describe('cryptoAssetStore (no DB)', () => {
    beforeEach(() => {
        mockFindBySymbol.mockReset();
        mockSearch.mockReset();
        mockDbClient = null;
    });

    it('isCryptoSymbol returns false when DB is unavailable', async () => {
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
