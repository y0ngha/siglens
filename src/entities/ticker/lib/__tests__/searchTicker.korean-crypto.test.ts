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
        expect(results.find(r => r.symbol === 'BTCUSD')).toEqual(
            cryptoResult('BTCUSD', '비트코인')
        );
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
        expect(results.find(r => r.symbol === 'AAPL')).toEqual(
            stockResult('AAPL', '애플')
        );
    });

    it('"비트코인" 쿼리에서 popular 정확일치 crypto(BTCUSD)가 substring-match 주식보다 먼저 온다', async () => {
        // Several stocks whose koreanName merely contains "비트코인" as substring
        const substockResults = [
            stockResult('STOCK0', '가나비트코인다라'),
            stockResult('STOCK1', '마바비트코인사아'),
            stockResult('STOCK2', '자차비트코인카타'),
            stockResult('STOCK3', '파하비트코인가나'),
            stockResult('STOCK4', '다라비트코인마바'),
            stockResult('STOCK5', '사아비트코인자차'),
        ];
        // BTCUSD: exact koreanName match + popular → score 115
        // VIDTUSD: exact koreanName match, not popular → score 100
        // stocks: substring match → score 40
        mockSearchByKoreanName.mockResolvedValue(substockResults);
        mockSearchCryptoAssets.mockResolvedValue([
            cryptoResult('VIDTUSD', '비트코인'),
            cryptoResult('BTCUSD', '비트코인'),
        ]);

        const results = await searchTicker('비트코인');
        expect(results[0].symbol).toBe('BTCUSD');
        expect(results[1].symbol).toBe('VIDTUSD');
        // all substocks should rank below both cryptos
        const stockSymbols = results
            .map(r => r.symbol)
            .filter(s => s.startsWith('STOCK'));
        const btcIdx = results.findIndex(r => r.symbol === 'BTCUSD');
        const vidtIdx = results.findIndex(r => r.symbol === 'VIDTUSD');
        for (const sym of stockSymbols) {
            const idx = results.findIndex(r => r.symbol === sym);
            expect(idx).toBeGreaterThan(btcIdx);
            expect(idx).toBeGreaterThan(vidtIdx);
        }
    });

    it('"수이" 쿼리에서 popular crypto(SUIUSD)가 substring-match 주식보다 먼저 온다', async () => {
        // Several OTC stocks whose koreanName contains "수이" as substring
        const otcStocks = [
            stockResult('OTC0', '수이테크놀로지'),
            stockResult('OTC1', '수이코퍼레이션'),
            stockResult('OTC2', '수이그룹'),
            stockResult('OTC3', '수이인터내셔널'),
            stockResult('OTC4', '수이홀딩스'),
            stockResult('OTC5', '수이파트너스'),
        ];
        // SUIUSD: exact koreanName match + popular → 115
        mockSearchByKoreanName.mockResolvedValue(otcStocks);
        mockSearchCryptoAssets.mockResolvedValue([
            cryptoResult('SUIUSD', '수이'),
        ]);

        const results = await searchTicker('수이');
        expect(results[0].symbol).toBe('SUIUSD');
        const suiIdx = results.findIndex(r => r.symbol === 'SUIUSD');
        for (const stock of otcStocks) {
            const idx = results.findIndex(r => r.symbol === stock.symbol);
            expect(idx).toBeGreaterThan(suiIdx);
        }
    });
});
