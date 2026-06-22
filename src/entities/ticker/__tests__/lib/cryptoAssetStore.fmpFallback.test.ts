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

// isCryptoSymbol is imported dynamically per-test (after vi.resetModules) to
// obtain a fresh module with an empty cryptoSymbolCache between cases.
// The static import is intentionally omitted; see each it() for the pattern.

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

    it('DB miss + FMP-list HIT → true', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'NewCoin' });

        const result = await fresh('NEWCOIN');

        expect(result).toBe(true);
        expect(fmpCryptoMembershipMock).toHaveBeenCalledWith('NEWCOIN');
    });

    it('DB miss + FMP-list MISS → false', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFindBySymbolMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null);

        const result = await fresh('NOTACRYPTO');

        expect(result).toBe(false);
    });

    it('No DB client + FMP-list HIT → true', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'NewCoin' });

        const result = await fresh('NEWCOIN');

        expect(result).toBe(true);
    });

    it('No DB client + FMP-list MISS → false', async () => {
        const { isCryptoSymbol: fresh } =
            await import('../../lib/cryptoAssetStore');
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null);

        const result = await fresh('NOTACRYPTO');

        expect(result).toBe(false);
    });
});
