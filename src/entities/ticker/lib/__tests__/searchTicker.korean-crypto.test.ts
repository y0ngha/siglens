// vi.mock calls are hoisted by vitest above all imports.
const { mockSearchByKoreanName, mockSearchCryptoAssets } = vi.hoisted(() => ({
    mockSearchByKoreanName: vi.fn(),
    mockSearchCryptoAssets: vi.fn(),
}));

vi.mock('../koreanNameStore', () => ({
    searchByKoreanName: mockSearchByKoreanName,
    getKoreanNames: vi.fn().mockResolvedValue({}),
    setKoreanTickers: vi.fn(),
}));
vi.mock('../cryptoAssetStore', () => ({
    searchCryptoAssets: mockSearchCryptoAssets,
}));
vi.mock('../fmpTickerApi', () => ({
    searchBySymbol: vi.fn().mockResolvedValue([]),
    searchByName: vi.fn().mockResolvedValue([]),
    filterUsExchanges: (x: unknown[]) => x,
    toTickerSearchResult: (x: unknown) => x,
}));
vi.mock('@y0ngha/siglens-core', () => ({ createCacheProvider: () => null }));
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

function stockResult(symbol: string, koreanName: string): TickerSearchResult {
    return {
        symbol,
        name: `${symbol} Corp`,
        koreanName,
        exchange: 'NASDAQ',
        exchangeFullName: 'Nasdaq Global Select Market',
    };
}

function cryptoResult(symbol: string, koreanName: string): TickerSearchResult {
    return {
        symbol,
        name: `${symbol} Coin`,
        koreanName,
        exchange: 'CRYPTO',
        exchangeFullName: 'Cryptocurrency',
        marketProfile: 'crypto',
    };
}

describe('searchTicker — 한글 입력 crypto 병합', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetInFlightTranslationsForTest();
        mockSearchByKoreanName.mockResolvedValue([]);
        mockSearchCryptoAssets.mockResolvedValue([]);
    });

    it('한글 입력 시 crypto 한국어 검색 결과를 함께 반환한다', async () => {
        mockSearchByKoreanName.mockResolvedValue([]);
        mockSearchCryptoAssets.mockResolvedValue([
            cryptoResult('BTCUSD', '비트코인'),
        ]);

        const results = await searchTicker('비트코');
        expect(results.some(r => r.symbol === 'BTCUSD')).toBe(true);
    });

    it('한글 입력 시 주식 한국어 결과가 crypto 결과보다 먼저 온다', async () => {
        mockSearchByKoreanName.mockResolvedValue([stockResult('AAPL', '애플')]);
        mockSearchCryptoAssets.mockResolvedValue([
            cryptoResult('BTCUSD', '비트코인'),
        ]);

        const results = await searchTicker('코');
        const aaplIdx = results.findIndex(r => r.symbol === 'AAPL');
        const btcIdx = results.findIndex(r => r.symbol === 'BTCUSD');
        expect(aaplIdx).toBeGreaterThanOrEqual(0);
        expect(btcIdx).toBeGreaterThanOrEqual(0);
        expect(aaplIdx).toBeLessThan(btcIdx);
    });

    it('한글 입력 시 동일 symbol 중복 제거한다', async () => {
        const shared = stockResult('BTCUSD', '비트코인');
        mockSearchByKoreanName.mockResolvedValue([shared]);
        mockSearchCryptoAssets.mockResolvedValue([
            cryptoResult('BTCUSD', '비트코인'),
        ]);

        const results = await searchTicker('비트코인');
        const btcEntries = results.filter(r => r.symbol === 'BTCUSD');
        expect(btcEntries).toHaveLength(1);
    });

    it('한글 입력 결과를 MAX_SEARCH_RESULTS로 제한한다', async () => {
        const manyStocks = Array.from({ length: 7 }, (_, i) =>
            stockResult(`STOCK${i}`, `주식${i}`)
        );
        const manyCrypto = Array.from({ length: 6 }, (_, i) =>
            cryptoResult(`COIN${i}USD`, `코인${i}`)
        );
        mockSearchByKoreanName.mockResolvedValue(manyStocks);
        mockSearchCryptoAssets.mockResolvedValue(manyCrypto);

        const results = await searchTicker('주');
        // 7 stocks + 6 crypto = 13 unique symbols → deterministically capped to MAX.
        expect(results).toHaveLength(MAX_SEARCH_RESULTS);
    });

    it('한글 입력 시 FMP searchBySymbol/searchByName 을 호출하지 않는다', async () => {
        const { searchBySymbol, searchByName } =
            await import('../fmpTickerApi');
        mockSearchByKoreanName.mockResolvedValue([stockResult('AAPL', '애플')]);

        await searchTicker('애플');

        expect(searchBySymbol).not.toHaveBeenCalled();
        expect(searchByName).not.toHaveBeenCalled();
    });

    it('crypto store 가 에러를 던져도 주식 결과는 반환한다', async () => {
        mockSearchByKoreanName.mockResolvedValue([stockResult('AAPL', '애플')]);
        mockSearchCryptoAssets.mockRejectedValue(
            new Error('DB connection failed')
        );

        const results = await searchTicker('애플');
        expect(results.some(r => r.symbol === 'AAPL')).toBe(true);
    });

    it('주식 결과가 MAX를 채워도 crypto 결과가 보장된다', async () => {
        // 10 stock results would normally starve crypto results entirely.
        // With CRYPTO_RESERVE=3, stock is capped at 7 and crypto gets ≥1 slot.
        const manyStocks = Array.from({ length: 10 }, (_, i) =>
            stockResult(`STOCK${i}`, `주식${i}`)
        );
        const someCrypto = [cryptoResult('BTCUSD', '비트코인')];
        mockSearchByKoreanName.mockResolvedValue(manyStocks);
        mockSearchCryptoAssets.mockResolvedValue(someCrypto);

        const results = await searchTicker('주');
        expect(results).toHaveLength(MAX_SEARCH_RESULTS);
        expect(results.some(r => r.symbol === 'BTCUSD')).toBe(true);
    });
});
