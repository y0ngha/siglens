// vi.mock calls are hoisted by vitest above all imports — must appear before any import statements.
const { mockSearchBySymbol, mockSearchByName, mockSearchCryptoAssets } =
    vi.hoisted(() => ({
        mockSearchBySymbol: vi.fn(),
        mockSearchByName: vi.fn(),
        mockSearchCryptoAssets: vi.fn(),
    }));

vi.mock('../fmpTickerApi', () => ({
    searchBySymbol: mockSearchBySymbol,
    searchByName: mockSearchByName,
    filterUsExchanges: (x: unknown[]) => x,
    toTickerSearchResult: (x: unknown) => x,
}));
vi.mock('../cryptoAssetStore', () => ({
    searchCryptoAssets: mockSearchCryptoAssets,
}));
vi.mock('@y0ngha/siglens-core', () => ({ createCacheProvider: () => null }));
vi.mock('../koreanNameStore', () => ({
    getKoreanNames: vi.fn().mockResolvedValue({}),
    searchByKoreanName: vi.fn().mockResolvedValue([]),
    setKoreanTickers: vi.fn(),
}));
// translateCompanyNames is a background fire-and-forget; suppress in unit tests.
vi.mock('../koreanTranslator', () => ({
    translateCompanyNames: vi.fn().mockResolvedValue({}),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    searchTicker,
    _resetInFlightTranslationsForTest,
} from '../searchTicker';
import type { TickerSearchResult } from '@/shared/lib/types';

/** Build a minimal TickerSearchResult for FMP results. */
function fmpResult(symbol: string): TickerSearchResult {
    return {
        symbol,
        name: `${symbol} Inc.`,
        exchange: 'NASDAQ',
        exchangeFullName: 'Nasdaq Global Select Market',
    };
}

/** Build a minimal TickerSearchResult for crypto results. */
function cryptoResult(symbol: string): TickerSearchResult {
    return {
        symbol,
        name: `${symbol} Coin`,
        exchange: 'CRYPTO',
        exchangeFullName: 'Cryptocurrency',
        marketProfile: 'crypto',
    };
}

describe('searchTicker — crypto merge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetInFlightTranslationsForTest();
        // Default: no FMP results, one crypto result.
        mockSearchBySymbol.mockResolvedValue([]);
        mockSearchByName.mockResolvedValue([]);
        mockSearchCryptoAssets.mockResolvedValue([cryptoResult('BTCUSD')]);
    });

    it('surfaces crypto results that FMP search would not return', async () => {
        const results = await searchTicker('BTC');
        expect(results.some(r => r.symbol === 'BTCUSD')).toBe(true);
    });

    // --- Rec #5: merge edge cases ---

    it('deduplicates when a crypto symbol also appears in FMP results', async () => {
        // BTCUSD returned by both FMP and the crypto store → must appear once.
        mockSearchBySymbol.mockResolvedValue([fmpResult('BTCUSD')]);
        mockSearchCryptoAssets.mockResolvedValue([cryptoResult('BTCUSD')]);

        const results = await searchTicker('BTC');

        const btcEntries = results.filter(r => r.symbol === 'BTCUSD');
        expect(btcEntries).toHaveLength(1);
    });

    it('FMP result wins over crypto when the same symbol collides (first-seen dedup)', async () => {
        // searchTicker merges [symbolResults, nameResults, cryptoResults] in that
        // order and deduplicates by first-seen. The FMP result lands first, so the
        // deduplicated entry should carry the FMP exchange value (NASDAQ, not CRYPTO).
        mockSearchBySymbol.mockResolvedValue([fmpResult('BTCUSD')]);
        mockSearchCryptoAssets.mockResolvedValue([cryptoResult('BTCUSD')]);

        const results = await searchTicker('BTC');

        const entry = results.find(r => r.symbol === 'BTCUSD');
        expect(entry?.exchange).toBe('NASDAQ');
    });

    it('caps total results at MAX_SEARCH_RESULTS (10) when crypto+stock overflow', async () => {
        // 8 FMP results + 5 crypto results = 13 total before cap → must cap at 10.
        const fmpResults = Array.from({ length: 8 }, (_, i) =>
            fmpResult(`STOCK${i}`)
        );
        const cryptoResults = Array.from({ length: 5 }, (_, i) =>
            cryptoResult(`COIN${i}USD`)
        );
        mockSearchBySymbol.mockResolvedValue(fmpResults);
        mockSearchCryptoAssets.mockResolvedValue(cryptoResults);

        const results = await searchTicker('x');

        expect(results.length).toBe(10);
    });

    it('empty crypto results do not break the merge (no throw)', async () => {
        mockSearchCryptoAssets.mockResolvedValue([]);
        mockSearchBySymbol.mockResolvedValue([fmpResult('AAPL')]);

        await expect(searchTicker('AAPL')).resolves.not.toThrow();

        const results = await searchTicker('AAPL');
        expect(results.some(r => r.symbol === 'AAPL')).toBe(true);
    });
});
