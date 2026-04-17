import {
    searchBySymbol,
    searchByName,
    filterUsExchanges,
    filterIndexResults,
    toDisplaySymbol,
    toTickerSearchResult,
} from '@/infrastructure/ticker/fmpTickerApi';
import type { FmpSearchResult } from '@/infrastructure/ticker/types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const makeFmpResult = (
    overrides: Partial<FmpSearchResult> = {}
): FmpSearchResult => ({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    exchangeFullName: 'NASDAQ Global Select',
    exchange: 'NASDAQ',
    ...overrides,
});

describe('filterUsExchanges', () => {
    describe('US 거래소 결과만 포함할 때', () => {
        it('모든 결과를 반환한다', () => {
            const results = [
                makeFmpResult({ exchange: 'NYSE' }),
                makeFmpResult({ exchange: 'NASDAQ' }),
                makeFmpResult({ exchange: 'AMEX' }),
                makeFmpResult({ exchange: 'NYSEArca' }),
            ];
            expect(filterUsExchanges(results)).toHaveLength(4);
        });
    });

    describe('비US 거래소 결과가 포함될 때', () => {
        it('US 거래소 결과만 반환한다', () => {
            const results = [
                makeFmpResult({ symbol: 'AAPL', exchange: 'NASDAQ' }),
                makeFmpResult({ symbol: 'BTC', exchange: 'CRYPTO' }),
                makeFmpResult({ symbol: 'SAMSNG', exchange: 'KSE' }),
            ];
            const filtered = filterUsExchanges(results);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].symbol).toBe('AAPL');
        });
    });

    describe('빈 배열일 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(filterUsExchanges([])).toEqual([]);
        });
    });
});

describe('filterIndexResults', () => {
    describe('^ 접두사를 가진 심볼만 포함할 때', () => {
        it('모든 결과를 반환한다', () => {
            const results = [
                makeFmpResult({ symbol: '^SPX' }),
                makeFmpResult({ symbol: '^DJI' }),
            ];
            expect(filterIndexResults(results)).toHaveLength(2);
        });
    });

    describe('일반 주식 심볼이 혼합될 때', () => {
        it('^ 접두사 심볼만 반환한다', () => {
            const results = [
                makeFmpResult({ symbol: '^SPX' }),
                makeFmpResult({ symbol: 'AAPL' }),
                makeFmpResult({ symbol: '^VIX' }),
            ];
            const filtered = filterIndexResults(results);
            expect(filtered).toHaveLength(2);
            expect(filtered.map(r => r.symbol)).toEqual(['^SPX', '^VIX']);
        });
    });

    describe('빈 배열일 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(filterIndexResults([])).toEqual([]);
        });
    });

    describe('^ 접두사가 없는 결과만 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            const results = [makeFmpResult({ symbol: 'AAPL' })];
            expect(filterIndexResults(results)).toEqual([]);
        });
    });
});

describe('toDisplaySymbol', () => {
    describe('^ 접두사가 있을 때', () => {
        it('^SPX를 SPX로 변환한다', () => {
            expect(toDisplaySymbol('^SPX')).toBe('SPX');
        });

        it('^DJI를 DJI로 변환한다', () => {
            expect(toDisplaySymbol('^DJI')).toBe('DJI');
        });
    });

    describe('^ 접두사가 없을 때', () => {
        it('심볼을 그대로 반환한다', () => {
            expect(toDisplaySymbol('AAPL')).toBe('AAPL');
        });
    });

    describe('빈 문자열일 때', () => {
        it('빈 문자열을 반환한다', () => {
            expect(toDisplaySymbol('')).toBe('');
        });
    });
});

describe('toTickerSearchResult', () => {
    describe('FmpSearchResult를 TickerSearchResult로 변환할 때', () => {
        it('모든 필드를 올바르게 매핑한다', () => {
            const fmp = makeFmpResult();
            const result = toTickerSearchResult(fmp);
            expect(result).toEqual({
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            });
        });

        it('currency 필드는 포함하지 않는다', () => {
            const result = toTickerSearchResult(makeFmpResult());
            expect(result).not.toHaveProperty('currency');
        });
    });
});

describe('searchBySymbol', () => {
    beforeEach(() => {
        process.env.FMP_API_KEY = 'test-key';
        mockFetch.mockReset();
    });

    afterEach(() => {
        delete process.env.FMP_API_KEY;
    });

    describe('FMP_API_KEY가 없을 때', () => {
        it('빈 배열을 반환한다', async () => {
            delete process.env.FMP_API_KEY;
            const result = await searchBySymbol('AAPL');
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('API 호출이 성공할 때', () => {
        it('FmpSearchResult 배열을 반환한다', async () => {
            const mockData = [makeFmpResult()];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });
            const result = await searchBySymbol('AAPL');
            expect(result).toEqual(mockData);
        });
    });

    describe('API가 비배열 응답을 반환할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ error: 'not found' }),
            });
            const result = await searchBySymbol('AAPL');
            expect(result).toEqual([]);
        });
    });

    describe('API가 HTTP 에러를 반환할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
            });
            const result = await searchBySymbol('AAPL');
            expect(result).toEqual([]);
        });
    });

    describe('네트워크 에러가 발생할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network error'));
            const result = await searchBySymbol('AAPL');
            expect(result).toEqual([]);
        });
    });
});

describe('searchByName', () => {
    beforeEach(() => {
        process.env.FMP_API_KEY = 'test-key';
        mockFetch.mockReset();
    });

    afterEach(() => {
        delete process.env.FMP_API_KEY;
    });

    describe('FMP_API_KEY가 없을 때', () => {
        it('빈 배열을 반환한다', async () => {
            delete process.env.FMP_API_KEY;
            const result = await searchByName('Apple');
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('API 호출이 성공할 때', () => {
        it('FmpSearchResult 배열을 반환한다', async () => {
            const mockData = [makeFmpResult()];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });
            const result = await searchByName('Apple');
            expect(result).toEqual(mockData);
        });
    });

    describe('API가 비배열 응답을 반환할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => null,
            });
            const result = await searchByName('Apple');
            expect(result).toEqual([]);
        });
    });

    describe('API가 HTTP 에러를 반환할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });
            const result = await searchByName('Apple');
            expect(result).toEqual([]);
        });
    });

    describe('네트워크 에러가 발생할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network error'));
            const result = await searchByName('Apple');
            expect(result).toEqual([]);
        });
    });
});
