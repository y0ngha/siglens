import { vi } from 'vitest';
import type { CacheProvider } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/shared/lib/types';
import type { FmpSearchResult } from '../../model';

const {
    mockCache,
    createCacheProviderMock,
    searchBySymbolMock,
    searchByNameMock,
    searchByKoreanNameMock,
    getKoreanNamesMock,
    setKoreanTickersMock,
    translateCompanyNamesMock,
} = vi.hoisted(() => ({
    mockCache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
    createCacheProviderMock: vi.fn(),
    searchBySymbolMock: vi.fn(),
    searchByNameMock: vi.fn(),
    searchByKoreanNameMock: vi.fn(),
    getKoreanNamesMock: vi.fn(),
    setKoreanTickersMock: vi.fn(),
    translateCompanyNamesMock: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => createCacheProviderMock(),
}));
vi.mock('../../lib/fmpTickerApi', async () => {
    const actual = await vi.importActual('../../lib/fmpTickerApi');
    return {
        ...actual,
        searchBySymbol: (q: string) => searchBySymbolMock(q),
        searchByName: (q: string) => searchByNameMock(q),
    };
});
vi.mock('../../lib/koreanNameStore', () => ({
    searchByKoreanName: (q: string) => searchByKoreanNameMock(q),
    getKoreanNames: (s: string[]) => getKoreanNamesMock(s),
    setKoreanTickers: (entries: unknown[]) => setKoreanTickersMock(entries),
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: () => translateCompanyNamesMock(),
}));

import {
    _resetInFlightTranslationsForTest,
    searchTicker,
} from '../../lib/searchTicker';

const apple: FmpSearchResult = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const microsoft: FmpSearchResult = {
    symbol: 'MSFT',
    name: 'Microsoft',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

describe('searchTicker', () => {
    beforeEach(() => {
        _resetInFlightTranslationsForTest();
        mockCache.get.mockReset();
        mockCache.set.mockReset();
        mockCache.set.mockResolvedValue(undefined);
        createCacheProviderMock.mockReset();
        createCacheProviderMock.mockReturnValue(
            mockCache as unknown as CacheProvider
        );
        searchBySymbolMock.mockReset();
        searchByNameMock.mockReset();
        searchByKoreanNameMock.mockReset();
        getKoreanNamesMock.mockReset();
        getKoreanNamesMock.mockResolvedValue({});
        setKoreanTickersMock.mockReset();
        setKoreanTickersMock.mockResolvedValue(undefined);
        translateCompanyNamesMock.mockReset();
        translateCompanyNamesMock.mockResolvedValue({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('빈 query 는 빈 배열 반환', async () => {
        await expect(searchTicker('   ')).resolves.toEqual([]);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('한글 query 는 koreanNameStore 검색 결과를 반환한다', async () => {
        const koreanResults: TickerSearchResult[] = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ];
        searchByKoreanNameMock.mockResolvedValue(koreanResults);
        await expect(searchTicker('애')).resolves.toEqual(koreanResults);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('cache hit 시 cached 값을 반환한다', async () => {
        const cached: TickerSearchResult[] = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ];
        mockCache.get.mockResolvedValue(cached);
        await expect(searchTicker('AAPL')).resolves.toEqual(cached);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('cache miss 시 FMP 결과를 한국명과 함께 반환한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([microsoft]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await searchTicker('AAPL');
        expect(result).toEqual([
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: '애플',
            },
            {
                symbol: 'MSFT',
                name: 'Microsoft',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: undefined,
            },
        ]);
        expect(mockCache.set).toHaveBeenCalledWith(
            'ticker:search:aapl',
            result,
            expect.any(Number)
        );
    });

    it('중복 심볼은 제거한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});

        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe('AAPL');
    });

    it('한국명 미보유 항목이 있으면 번역을 fire-and-forget 으로 트리거한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ AAPL: '애플' });

        await searchTicker('AAPL');
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);
    });

    it('동시 요청 시 동일한 번역 작업은 single-flight 로 한 번만 호출된다', async () => {
        // C7 single-flight: concurrent searchTicker calls for the same uncached
        // missing-translation set must collapse into one translateCompanyNames
        // invocation. Hold the translate promise open until all callers have
        // attached so the second call sees the in-flight entry.
        let resolveTranslate: (
            value: Record<string, string>
        ) => void = () => {};
        const translatePromise = new Promise<Record<string, string>>(
            resolve => {
                resolveTranslate = resolve;
            }
        );
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockReturnValue(translatePromise);

        const callers = await Promise.all([
            searchTicker('AAPL'),
            searchTicker('AAPL'),
            searchTicker('AAPL'),
            searchTicker('AAPL'),
            searchTicker('AAPL'),
        ]);

        // All callers complete (fire-and-forget translation does not block them)
        expect(callers).toHaveLength(5);
        // Single-flight: only one translateCompanyNames call across 5 callers.
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);

        // Resolve the promise so the .finally cleanup runs before next test.
        resolveTranslate({ AAPL: '애플' });
        await translatePromise;
    });

    it('waitUntil이 제공되면 번역과 캐시 저장 promise를 등록한다', async () => {
        const waitUntil = vi.fn();
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});

        await searchTicker('AAPL', { waitUntil });

        expect(waitUntil).toHaveBeenCalledTimes(2);
        expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    });

    it('cache provider 가 null 이어도 정상 동작', async () => {
        createCacheProviderMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);
    });

    it('cache get 실패 시 fallback 동작', async () => {
        mockCache.get.mockRejectedValue(new Error('cache down'));
        searchBySymbolMock.mockResolvedValue([apple]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});
        const result = await searchTicker('AAPL');
        expect(result).toHaveLength(1);
    });

    it('US 거래소가 아닌 결과는 제외한다', async () => {
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([{ ...apple, exchange: 'TOKYO' }]);
        searchByNameMock.mockResolvedValue([]);
        getKoreanNamesMock.mockResolvedValue({});

        const result = await searchTicker('AAPL');
        expect(result).toEqual([]);
    });
});
