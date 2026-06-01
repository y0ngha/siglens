import {
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from '../../lib/fmpTickerApi';
import type { FmpSearchResult } from '../../model';

const mockFetch = vi.fn();

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

    it('NYSE/NASDAQ/AMEX/CBOE/OTC/PNK를 모두 인식한다', () => {
        const inputs: FmpSearchResult[] = (
            ['NYSE', 'NASDAQ', 'AMEX', 'CBOE', 'OTC', 'PNK'] as const
        ).map(exchange => ({ ...apple, exchange }));
        expect(filterUsExchanges(inputs)).toHaveLength(6);
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

    it('필수 필드가 누락된 row 는 검증 단계에서 제외하고 유효한 row 만 반환한다', async () => {
        const malformed = { symbol: 'BAD' }; // missing name/currency/exchange/exchangeFullName
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [apple, malformed],
        });

        const result = await searchBySymbol('AAPL');

        expect(result).toEqual([apple]);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('dropped 1 malformed FMP row')
        );
        warnSpy.mockRestore();
    });

    describe('strict mode (getAssetInfo 경로)', () => {
        it('!res.ok(429/5xx)면 throw한다', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 429 });
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
        });

        it('network/timeout 예외면 throw한다', async () => {
            mockFetch.mockRejectedValue(new Error('network down'));
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
        });

        it('200 + 빈 배열은 throw하지 않고 [] 반환 (legit no-match)', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => [],
            });
            await expect(
                searchBySymbol('NOPE', { strict: true })
            ).resolves.toEqual([]);
        });

        it('lenient(기본값)는 에러 시 여전히 []로 degrade한다', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 500 });
            await expect(searchBySymbol('AAPL')).resolves.toEqual([]);
        });

        it('FMP config 없음(strict)이면 throw하고 fetch하지 않는다', async () => {
            delete process.env.FMP_API_KEY;
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('200 + 비배열 응답(strict)이면 throw한다', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ error: 'invalid' }),
            });
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
        });

        it('JSON 파싱 실패(strict)면 throw한다', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error('invalid json');
                },
            });
            await expect(
                searchBySymbol('AAPL', { strict: true })
            ).rejects.toThrow();
        });
    });
});
