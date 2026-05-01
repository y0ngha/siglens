import {
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from '@/infrastructure/ticker/fmpTickerApi';
import type { FmpSearchResult } from '@/infrastructure/ticker/types';

const mockFetch = jest.fn();

const apple: FmpSearchResult = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const tokyoSony: FmpSearchResult = {
    symbol: 'SONY.T',
    name: 'Sony Corp',
    currency: 'JPY',
    exchange: 'TOKYO',
    exchangeFullName: 'Tokyo Stock Exchange',
};

describe('toTickerSearchResult', () => {
    it('FmpSearchResult를 TickerSearchResult 형태로 변환한다 (currency 제거)', () => {
        expect(toTickerSearchResult(apple)).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            exchange: 'NASDAQ',
            exchangeFullName: 'NASDAQ Global Select',
        });
    });
});

describe('filterUsExchanges', () => {
    it('미국 거래소만 남기고 나머지는 제외한다', () => {
        const results = [apple, tokyoSony];
        expect(filterUsExchanges(results)).toEqual([apple]);
    });

    it('NYSE/NASDAQ/AMEX/NYSEArca를 모두 인식한다', () => {
        const inputs: FmpSearchResult[] = (
            ['NYSE', 'NASDAQ', 'AMEX', 'NYSEArca'] as const
        ).map(exchange => ({ ...apple, exchange }));
        expect(filterUsExchanges(inputs)).toHaveLength(4);
    });
});

describe('searchBySymbol/searchByName', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = 'test-key';
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.FMP_API_KEY;
    });

    it('FMP_API_KEY가 없으면 빈 배열을 반환한다', async () => {
        delete process.env.FMP_API_KEY;
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
        await expect(searchByName('Apple')).resolves.toEqual([]);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('정상 응답을 그대로 반환한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        const result = await searchBySymbol('AAPL');
        expect(result).toEqual([apple]);
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('search-symbol');
        expect(url).toContain('query=AAPL');
        expect(url).toContain('apikey=test-key');
    });

    it('searchByName은 search-name 엔드포인트를 호출한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple],
        });
        await searchByName('Apple');
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('search-name');
        expect(url).toContain('query=Apple');
    });

    it('응답이 ok가 아니면 빈 배열을 반환한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Server Error',
        });
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
    });

    it('JSON이 배열이 아니면 빈 배열을 반환한다', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ error: 'invalid' }),
        });
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
    });

    it('fetch가 throw하면 빈 배열을 반환한다', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'));
        await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
    });
});
