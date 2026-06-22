import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    tryGetTickerDatabaseClientMock,
    repositoryFindBySymbolMock,
    fmpCryptoMembershipMock,
} = vi.hoisted(() => ({
    tryGetTickerDatabaseClientMock: vi.fn(),
    repositoryFindBySymbolMock: vi.fn(),
    fmpCryptoMembershipMock: vi.fn(),
}));

vi.mock('../../lib/db', () => ({
    tryGetTickerDatabaseClient: () => tryGetTickerDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleCryptoAssetRepository: class {
        findBySymbol = repositoryFindBySymbolMock;
        search = vi.fn().mockResolvedValue([]);
    },
}));
vi.mock('../../lib/fmpCryptoMembership', () => ({
    fmpCryptoMembership: fmpCryptoMembershipMock,
}));

// isCryptoSymbol / getCryptoAsset are imported dynamically per-test (after
// vi.resetModules) to obtain a fresh module with an empty cryptoSymbolCache
// between cases. Static imports are intentionally omitted; see each it().

describe('isCryptoSymbol — FMP-list fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset module-level caches between tests
        vi.resetModules();
    });

    it('DB HIT → true, no FMP-list check', async () => {
        // Re-import after resetModules to get fresh cache state
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue({
            symbol: 'BTC',
            name: 'Bitcoin',
        });
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'Bitcoin' });

        const result = await fresh('BTC');

        expect(result).toBe(true);
        expect(fmpCryptoMembershipMock).not.toHaveBeenCalled();
    });

    it('DB miss + FMP-list HIT → true, result cached (2nd call skips FMP)', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'NewCoin' });

        const result = await fresh('NEWCOIN');

        expect(result).toBe(true);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledWith('NEWCOIN');

        // Second call must hit the cryptoSymbolCache and skip FMP entirely.
        const cached = await fresh('NEWCOIN');
        expect(cached).toBe(true);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);
    });

    it('DB miss + FMP-list MISS → false, result cached', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null);

        const result = await fresh('NOTACRYPTO');

        expect(result).toBe(false);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);

        // Second call must hit cache, not call FMP again.
        const cached = await fresh('NOTACRYPTO');
        expect(cached).toBe(false);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);
    });

    it('No DB client + FMP-list HIT → true, result cached', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'NewCoin' });

        const result = await fresh('NEWCOIN');

        expect(result).toBe(true);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);

        // Second call must hit cache.
        const cached = await fresh('NEWCOIN');
        expect(cached).toBe(true);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);
    });

    it('No DB client + FMP-list MISS → false, result cached', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null);

        const result = await fresh('NOTACRYPTO');

        expect(result).toBe(false);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);

        // Second call must hit cache.
        const cached = await fresh('NOTACRYPTO');
        expect(cached).toBe(false);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledTimes(1);
    });
});

describe('cryptoSymbolCache pollution — regression', () => {
    /**
     * Regression: getCryptoAsset (DB-only) used to write `false` into
     * cryptoSymbolCache on a DB miss, poisoning the cache for isCryptoSymbol.
     * When NEWCOIN was not yet seeded in crypto_assets but present on the
     * FMP cryptocurrency-list, the following sequence would incorrectly return
     * false for isCryptoSymbol('NEWCOIN'):
     *
     *   1. getCryptoAsset('NEWCOIN') → DB miss → cryptoSymbolCache.set('NEWCOIN', false)  [BUG]
     *   2. isCryptoSymbol('NEWCOIN') → cache hit → returns false   [wrong!]
     *
     * After the fix, getCryptoAsset does NOT write false on DB miss, so
     * isCryptoSymbol proceeds to the FMP-list fallback and returns true.
     */
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('getCryptoAsset DB miss does NOT poison cryptoSymbolCache — isCryptoSymbol still returns true via FMP-list', async () => {
        const { getCryptoAsset, isCryptoSymbol } =
            await import('../../lib/cryptoAssetStore');

        // DB is available but NEWCOIN is not seeded yet (miss).
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(null);
        // FMP-list knows about NEWCOIN.
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'NewCoin' });

        // Step 1: getCryptoAsset is called first (DB miss, no FMP-list check).
        const asset = await getCryptoAsset('NEWCOIN');
        expect(asset).toBeNull();

        // Step 2: isCryptoSymbol must NOT be short-circuited by a poisoned false.
        // It must fall through to the FMP-list and return true.
        const isCrypto = await isCryptoSymbol('NEWCOIN');
        expect(isCrypto).toBe(true);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledWith('NEWCOIN');
    });

    it('getCryptoAsset DB HIT primes cryptoSymbolCache — isCryptoSymbol returns true without DB round-trip', async () => {
        const { getCryptoAsset, isCryptoSymbol } =
            await import('../../lib/cryptoAssetStore');

        const record = {
            symbol: 'BTC',
            name: 'Bitcoin',
            koreanName: null,
            circulatingSupply: null,
        };
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(record);

        // getCryptoAsset primes cryptoSymbolCache with true.
        const asset = await getCryptoAsset('BTC');
        expect(asset).toEqual(record);

        // isCryptoSymbol must hit the primed cache — no extra DB or FMP calls.
        const isCrypto = await isCryptoSymbol('BTC');
        expect(isCrypto).toBe(true);
        // repositoryFindBySymbol called exactly once (by getCryptoAsset).
        expect(repositoryFindBySymbolMock).toHaveBeenCalledTimes(1);
        expect(fmpCryptoMembershipMock).not.toHaveBeenCalled();
    });

    it('stock symbol (DB miss + FMP-list miss) is not poisoned — resolves as non-crypto', async () => {
        const { getCryptoAsset, isCryptoSymbol } =
            await import('../../lib/cryptoAssetStore');

        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null); // not in FMP-list either

        // getCryptoAsset: DB miss, no FMP-list check — returns null.
        const asset = await getCryptoAsset('AAPL');
        expect(asset).toBeNull();

        // isCryptoSymbol: DB miss → FMP-list miss → false (correctly not crypto).
        const isCrypto = await isCryptoSymbol('AAPL');
        expect(isCrypto).toBe(false);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledWith('AAPL');
    });
});
