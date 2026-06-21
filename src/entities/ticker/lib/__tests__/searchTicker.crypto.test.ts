import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../fmpTickerApi', () => ({
    searchBySymbol: vi.fn().mockResolvedValue([]),
    searchByName: vi.fn().mockResolvedValue([]),
    filterUsExchanges: (x: unknown[]) => x,
    toTickerSearchResult: (x: unknown) => x,
}));
vi.mock('../cryptoAssetStore', () => ({
    searchCryptoAssets: vi.fn().mockResolvedValue([
        {
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            exchange: 'CRYPTO',
            exchangeFullName: 'Cryptocurrency',
            marketProfile: 'crypto',
        },
    ]),
}));
vi.mock('@y0ngha/siglens-core', () => ({ createCacheProvider: () => null }));
vi.mock('../koreanNameStore', () => ({
    getKoreanNames: vi.fn().mockResolvedValue({}),
    searchByKoreanName: vi.fn().mockResolvedValue([]),
    setKoreanTickers: vi.fn(),
}));

import { searchTicker } from '../searchTicker';

describe('searchTicker — crypto merge', () => {
    beforeEach(() => vi.clearAllMocks());

    it('surfaces crypto results that FMP search would not return', async () => {
        const results = await searchTicker('BTC');
        expect(results.some(r => r.symbol === 'BTCUSD')).toBe(true);
    });
});
