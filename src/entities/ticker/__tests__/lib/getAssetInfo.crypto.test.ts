// vi.mock calls are hoisted above all imports; declared first so they are in scope
// when vitest hoists them to the top of the compiled module.

// ---- hoisted mocks ----
const {
    mockCache,
    createCacheProviderMock,
    tryGetTickerDatabaseClientMock,
    getCryptoAssetMock,
    fmpCryptoMembershipMock,
    fetchCryptoQuoteNameMock,
    searchBySymbolMock,
} = vi.hoisted(() => ({
    mockCache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
    createCacheProviderMock: vi.fn(),
    tryGetTickerDatabaseClientMock: vi.fn(),
    getCryptoAssetMock: vi.fn(),
    fmpCryptoMembershipMock: vi.fn(),
    fetchCryptoQuoteNameMock: vi.fn(),
    searchBySymbolMock: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => createCacheProviderMock(),
}));
vi.mock('../../lib/db', () => ({
    tryGetTickerDatabaseClient: () => tryGetTickerDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleAssetTranslationRepository: class {
        findBySymbol = vi.fn().mockResolvedValue(null);
        upsert = vi.fn().mockResolvedValue(undefined);
    },
}));
vi.mock('../../lib/cryptoAssetStore', () => ({
    getCryptoAsset: getCryptoAssetMock,
}));
vi.mock('../../lib/fmpCryptoMembership', () => ({
    fmpCryptoMembership: fmpCryptoMembershipMock,
}));
vi.mock('../../lib/cryptoQuoteName', () => ({
    fetchCryptoQuoteName: fetchCryptoQuoteNameMock,
}));
vi.mock('../../lib/fmpTickerApi', async () => {
    const actual = await vi.importActual('../../lib/fmpTickerApi');
    return {
        ...actual,
        searchBySymbol: (q: string, options?: unknown) =>
            searchBySymbolMock(q, options),
    };
});
vi.mock('../../lib/koreanNameStore', () => ({
    getKoreanNames: vi.fn().mockResolvedValue({}),
    setKoreanTickers: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: vi.fn().mockResolvedValue({}),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CacheProvider } from '@y0ngha/siglens-core';
import type { CryptoAssetRecord } from '@/shared/db/types';
import {
    _resetInFlightTranslationsForTest,
    getAssetInfo,
} from '../../lib/getAssetInfo';
import { ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN } from '../../lib/cacheKeys';

describe('getAssetInfo — crypto resolution paths', () => {
    beforeEach(() => {
        _resetInFlightTranslationsForTest();
        mockCache.get.mockReset();
        mockCache.get.mockResolvedValue(null);
        mockCache.set.mockReset();
        mockCache.set.mockResolvedValue(undefined);
        createCacheProviderMock.mockReturnValue(
            mockCache as unknown as CacheProvider
        );
        tryGetTickerDatabaseClientMock.mockReturnValue({ db: {} });
        getCryptoAssetMock.mockReset();
        fmpCryptoMembershipMock.mockReset();
        fetchCryptoQuoteNameMock.mockReset();
        searchBySymbolMock.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('DB hit (crypto_assets) wins — returns crypto AssetInfo with DB name, does not call fmpCryptoMembership', async () => {
        const dbRecord: CryptoAssetRecord = {
            symbol: 'BTC',
            name: 'Bitcoin',
            koreanName: '비트코인',
            circulatingSupply: 19_000_000,
        };
        getCryptoAssetMock.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('BTC');

        expect(result).toEqual({
            symbol: 'BTC',
            name: 'Bitcoin',
            marketProfile: 'crypto',
            koreanName: '비트코인',
        });
        expect(fmpCryptoMembershipMock).not.toHaveBeenCalled();
    });

    it('DB miss + FMP-list HIT → returns crypto AssetInfo (marketProfile: crypto, name from list)', async () => {
        getCryptoAssetMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'New Coin' });

        const result = await getAssetInfo('NEWCOIN');

        expect(result).toEqual({
            symbol: 'NEWCOIN',
            name: 'New Coin',
            marketProfile: 'crypto',
        });
        // No koreanName since FMP-list has no Korean data
        expect(result).not.toHaveProperty('koreanName');
        // Stock search path should NOT be called
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('DB miss + FMP-list HIT with empty name → falls back to fetchCryptoQuoteName', async () => {
        getCryptoAssetMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: '' });
        fetchCryptoQuoteNameMock.mockResolvedValue('New Coin From Quote');

        const result = await getAssetInfo('NEWCOIN');

        expect(result?.name).toBe('New Coin From Quote');
        expect(result?.marketProfile).toBe('crypto');
        expect(fetchCryptoQuoteNameMock).toHaveBeenCalledWith('NEWCOIN');
    });

    it('DB miss + FMP-list MISS → falls through to stock path', async () => {
        getCryptoAssetMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([]);

        const result = await getAssetInfo('NOTCRYPTO');

        expect(result).toBeNull();
        expect(searchBySymbolMock).toHaveBeenCalledWith('NOTCRYPTO', {
            throwOnInfraFailure: true,
        });
    });

    it('DB miss + FMP-list MISS + stock match → returns stock AssetInfo (no marketProfile)', async () => {
        getCryptoAssetMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                currency: 'USD',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ]);

        const result = await getAssetInfo('AAPL');

        expect(result?.symbol).toBe('AAPL');
        expect(result?.name).toBe('Apple Inc.');
        expect(result).not.toHaveProperty('marketProfile');
    });

    it('FMP-list HIT result is written to cache (cacheKey, TTL)', async () => {
        getCryptoAssetMock.mockResolvedValue(null);
        fmpCryptoMembershipMock.mockResolvedValue({ name: 'New Coin' });

        await getAssetInfo('NEWCOIN');

        // TTL must be the 12 h "incomplete/retry" constant — not the 1 yr
        // WITH_KOREAN constant — because FMP-list records have no koreanName
        // and are provisional until the next crypto_assets re-seed.
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:NEWCOIN',
            { symbol: 'NEWCOIN', name: 'New Coin', marketProfile: 'crypto' },
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
    });

    it('fmpCryptoMembership failure (returns null) degrades gracefully — falls through to stock path', async () => {
        getCryptoAssetMock.mockResolvedValue(null);
        // fmpCryptoMembership always returns null on failure (never throws)
        fmpCryptoMembershipMock.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([]);

        const result = await getAssetInfo('ANYSYM');
        expect(result).toBeNull();
        // The resolution path continued normally to FMP stock search
        expect(searchBySymbolMock).toHaveBeenCalled();
    });
});
