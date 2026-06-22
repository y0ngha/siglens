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
    MAX_SEARCH_RESULTS,
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

describe('searchTicker — non-Korean relevance ranking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetInFlightTranslationsForTest();
        mockSearchByName.mockResolvedValue([]);
        mockSearchCryptoAssets.mockResolvedValue([]);
    });

    it('ranks exact-symbol popular match above substring matches regardless of input order', async () => {
        // FMP returns: AAPLETECH first (substring match), AAPL second (exact match + popular).
        // rankByRelevance must reorder so AAPL leads.
        // AAPL:      exact symbol match  → EXACT_MATCH_SCORE + POPULAR_BONUS
        // AAPLETECH: prefix symbol match → PREFIX_MATCH_SCORE
        const substringFirst: TickerSearchResult[] = [
            {
                symbol: 'AAPLETECH',
                name: 'Aaple Technologies Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'Nasdaq',
            },
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'Nasdaq',
            },
        ];
        mockSearchBySymbol.mockResolvedValue(substringFirst);

        const results = await searchTicker('aapl');

        expect(results[0].symbol).toBe('AAPL');
    });

    it('popular symbol outranks same-quality non-popular symbol', async () => {
        // Both are exact matches but AAPL is popular, ZZZZ is not.
        // Input has ZZZZ first; relevance ranking must put AAPL first.
        const inputOrder: TickerSearchResult[] = [
            {
                symbol: 'ZZZZ',
                name: 'Aapl Placeholder',
                exchange: 'NASDAQ',
                exchangeFullName: 'Nasdaq',
            },
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'Nasdaq',
            },
        ];
        mockSearchBySymbol.mockResolvedValue(inputOrder);

        const results = await searchTicker('aapl');

        const aaplIdx = results.findIndex(r => r.symbol === 'AAPL');
        const zzzzIdx = results.findIndex(r => r.symbol === 'ZZZZ');
        expect(aaplIdx).toBeLessThan(zzzzIdx);
    });

    it('caps non-Korean results at MAX_SEARCH_RESULTS after relevance ranking', async () => {
        const many = Array.from({ length: MAX_SEARCH_RESULTS + 3 }, (_, i) =>
            fmpResult(`SYM${i}`)
        );
        mockSearchBySymbol.mockResolvedValue(many);

        const results = await searchTicker('sym');

        expect(results).toHaveLength(MAX_SEARCH_RESULTS);
    });
});
