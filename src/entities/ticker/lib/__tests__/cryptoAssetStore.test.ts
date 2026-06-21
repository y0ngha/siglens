import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCryptoSymbol, searchCryptoAssets } from '../cryptoAssetStore';

vi.mock('../db', () => ({
    tryGetTickerDatabaseClient: () => null, // no DB → graceful empty
}));

describe('cryptoAssetStore (no DB)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('isCryptoSymbol returns false when DB is unavailable', async () => {
        expect(await isCryptoSymbol('BTCUSD')).toBe(false);
    });

    it('searchCryptoAssets returns [] when DB is unavailable', async () => {
        expect(await searchCryptoAssets('btc')).toEqual([]);
    });
});
