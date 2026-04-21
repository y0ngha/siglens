import { searchTickerAction } from '@/infrastructure/ticker/searchTickerAction';
import type { TickerSearchResult } from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    filterIndexResults,
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from '@/infrastructure/ticker/fmpTickerApi';
import {
    getKoreanNames,
    searchByKoreanName,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();

jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));

jest.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: jest.fn(),
}));

jest.mock('@/infrastructure/ticker/fmpTickerApi', () => ({
    searchBySymbol: jest.fn(),
    searchByName: jest.fn(),
    filterUsExchanges: jest.fn((results: unknown[]) => results),
    filterIndexResults: jest.fn(() => []),
    toDisplaySymbol: jest.fn((s: string) =>
        s.startsWith('^') ? s.slice(1) : s
    ),
    toTickerSearchResult: jest.fn((r: TickerSearchResult) => r),
}));

jest.mock('@/infrastructure/ticker/koreanNameStore', () => ({
    searchByKoreanName: jest.fn(),
    getKoreanNames: jest.fn(),
    setKoreanTickers: jest.fn(),
}));

jest.mock('@/infrastructure/ticker/koreanTranslator', () => ({
    translateCompanyNames: jest.fn(),
}));

const mockCreateCacheProvider = createCacheProvider as jest.Mock;
const mockSearchBySymbol = searchBySymbol as jest.Mock;
const mockSearchByName = searchByName as jest.Mock;
const mockFilterUsExchanges = filterUsExchanges as jest.Mock;
const mockFilterIndexResults = filterIndexResults as jest.Mock;
const mockToTickerSearchResult = toTickerSearchResult as jest.Mock;
const mockSearchByKoreanName = searchByKoreanName as jest.Mock;
const mockGetKoreanNames = getKoreanNames as jest.Mock;
const mockSetKoreanTickers = setKoreanTickers as jest.Mock;
const mockTranslateCompanyNames = translateCompanyNames as jest.Mock;

const makeResult = (symbol: string): TickerSearchResult => ({
    symbol,
    name: `${symbol} Corp`,
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
});

describe('searchTickerAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCacheProvider.mockReturnValue({
            get: mockCacheGet,
            set: mockCacheSet,
            delete: mockCacheDelete,
        });
        mockFilterUsExchanges.mockImplementation(
            (results: unknown[]) => results
        );
        mockToTickerSearchResult.mockImplementation(
            (r: TickerSearchResult) => r
        );
        mockSearchBySymbol.mockResolvedValue([]);
        mockSearchByName.mockResolvedValue([]);
        mockGetKoreanNames.mockResolvedValue({});
        mockTranslateCompanyNames.mockResolvedValue({});
        mockSetKoreanTickers.mockResolvedValue(undefined);
        mockCacheGet.mockResolvedValue(null);
        mockCacheSet.mockResolvedValue(undefined);
    });

    describe('빈 쿼리일 때', () => {
        it('빈 배열을 반환한다', async () => {
            const result = await searchTickerAction('');
            expect(result).toEqual([]);
        });
    });

    describe('공백만 있는 쿼리일 때', () => {
        it('빈 배열을 반환한다', async () => {
            const result = await searchTickerAction('   ');
            expect(result).toEqual([]);
        });
    });

    describe('한국어 쿼리일 때', () => {
        it('searchByKoreanName 결과를 반환한다', async () => {
            const koreanResults = [makeResult('AAPL'), makeResult('AMZN')];
            mockSearchByKoreanName.mockResolvedValueOnce(koreanResults);

            const result = await searchTickerAction('애플');
            expect(mockSearchByKoreanName).toHaveBeenCalledWith('애플');
            expect(result).toEqual(koreanResults);
        });

        it('FMP API를 호출하지 않는다', async () => {
            mockSearchByKoreanName.mockResolvedValueOnce([]);

            await searchTickerAction('애플');
            expect(mockSearchBySymbol).not.toHaveBeenCalled();
            expect(mockSearchByName).not.toHaveBeenCalled();
        });

        it('최대 10개만 반환한다', async () => {
            const manyResults = Array.from({ length: 15 }, (_, i) =>
                makeResult(`SYM${i}`)
            );
            mockSearchByKoreanName.mockResolvedValueOnce(manyResults);

            const result = await searchTickerAction('회사');
            expect(result).toHaveLength(10);
        });
    });

    describe('영어 쿼리이고 캐시 히트일 때', () => {
        it('캐시된 결과를 즉시 반환한다', async () => {
            const cachedResults = [makeResult('AAPL')];
            mockCacheGet.mockResolvedValueOnce(cachedResults);

            const result = await searchTickerAction('AAPL');
            expect(result).toEqual(cachedResults);
            expect(mockSearchBySymbol).not.toHaveBeenCalled();
            expect(mockSearchByName).not.toHaveBeenCalled();
        });
    });

    describe('영어 쿼리이고 캐시 GET 중 에러가 발생할 때', () => {
        it('에러를 삼키고 FMP API를 호출한다', async () => {
            mockCacheGet.mockRejectedValueOnce(
                new Error('Redis connection error')
            );
            const symbolResult = makeResult('AAPL');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);

            const result = await searchTickerAction('AAPL');
            expect(result).toHaveLength(1);
            expect(mockSearchBySymbol).toHaveBeenCalledWith('AAPL');
        });
    });

    describe('영어 쿼리이고 캐시 미스일 때', () => {
        it('FMP API를 병렬로 호출한다 (심볼, 이름)', async () => {
            mockCacheGet.mockResolvedValueOnce(null);

            await searchTickerAction('AAPL');

            expect(mockSearchBySymbol).toHaveBeenCalledWith('AAPL');
            expect(mockSearchByName).toHaveBeenCalledWith('AAPL');
        });

        it('US 거래소 필터링을 적용한다', async () => {
            const symbolResult = makeResult('AAPL');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);

            await searchTickerAction('AAPL');

            expect(mockFilterUsExchanges).toHaveBeenCalled();
        });

        it('한국어 이름으로 결과를 enrichment한다', async () => {
            const symbolResult = makeResult('AAPL');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);
            mockGetKoreanNames.mockResolvedValueOnce({ AAPL: '애플' });

            const result = await searchTickerAction('AAPL');
            expect(result[0].koreanName).toBe('애플');
        });

        it('결과를 캐시에 저장한다', async () => {
            const symbolResult = makeResult('AAPL');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);

            await searchTickerAction('AAPL');
            expect(mockCacheSet).toHaveBeenCalled();
        });

        it('최대 10개만 반환한다', async () => {
            const manyResults = Array.from({ length: 20 }, (_, i) =>
                makeResult(`SYM${i}`)
            );
            mockSearchBySymbol.mockResolvedValueOnce(manyResults);
            mockSearchByName.mockResolvedValueOnce([]);

            const result = await searchTickerAction('SYM');
            expect(result).toHaveLength(10);
        });
    });

    describe('영어 쿼리이고 한국어 매핑이 없는 종목이 있을 때', () => {
        it('translateCompanyNames를 waitUntil로 등록한다', async () => {
            const symbolResult = makeResult('UNKNOWN');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockResolvedValue({ UNKNOWN: '언노운' });

            await searchTickerAction('UNKNOWN');

            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockTranslateCompanyNames).toHaveBeenCalled();
        });

        it('번역 결과에 unmapped에 없는 심볼이 포함되어도 해당 항목을 무시한다', async () => {
            const symbolResult = makeResult('UNKNOWN');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockResolvedValue({
                UNKNOWN: '언노운',
                EXTRA: '엑스트라',
            });

            await searchTickerAction('UNKNOWN');

            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockSetKoreanTickers).toHaveBeenCalledTimes(1);
            const savedEntries = mockSetKoreanTickers.mock
                .calls[0][0] as Array<{
                symbol: string;
            }>;
            expect(savedEntries.every(e => e.symbol !== 'EXTRA')).toBe(true);
        });
    });

    // TODO: 지수 심볼 검색 재활성화 시 describe.skip 제거
    describe.skip('지수 심볼 검색일 때', () => {
        it('^{query} 형식으로 searchBySymbol을 추가 호출한다', async () => {
            await searchTickerAction('SPX');
            expect(mockSearchBySymbol).toHaveBeenCalledWith('^SPX');
        });

        it('7자 이상 쿼리에서는 지수 검색을 건너뛴다', async () => {
            await searchTickerAction('TOOLONG');
            expect(mockSearchBySymbol).not.toHaveBeenCalledWith('^TOOLONG');
        });

        it('공백이 포함된 쿼리에서는 지수 검색을 건너뛴다', async () => {
            await searchTickerAction('S P X');
            expect(mockSearchBySymbol).not.toHaveBeenCalledWith('^S P X');
        });

        it('^ 로 시작하는 쿼리에서는 지수 검색을 건너뛴다', async () => {
            await searchTickerAction('^SPX');
            expect(mockSearchBySymbol).not.toHaveBeenCalledWith('^^SPX');
        });

        it('^ 접두사 검색 결과가 있으면 지수 결과를 포함한다', async () => {
            const indexFmpResult = {
                symbol: '^SPX',
                name: 'S&P 500',
                exchange: 'SNP',
                exchangeFullName: 'SNP',
            };
            mockFilterIndexResults.mockReturnValueOnce([indexFmpResult]);
            mockSearchBySymbol
                .mockResolvedValueOnce([]) // SPX 일반 검색
                .mockResolvedValueOnce([indexFmpResult]); // ^SPX 지수 검색

            await searchTickerAction('SPX');
            expect(mockFilterIndexResults).toHaveBeenCalledWith([
                indexFmpResult,
            ]);
        });

        it('지수 결과의 ^ 접두사가 제거된 심볼로 toTickerSearchResult를 호출한다', async () => {
            const indexFmpResult = {
                symbol: '^SPX',
                name: 'S&P 500',
                exchange: 'SNP',
                exchangeFullName: 'SNP',
            };
            mockFilterIndexResults.mockReturnValueOnce([indexFmpResult]);
            mockSearchBySymbol
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([indexFmpResult]);

            await searchTickerAction('SPX');
            expect(mockToTickerSearchResult).toHaveBeenCalledWith(
                expect.objectContaining({ symbol: 'SPX' })
            );
        });
    });

    describe('캐시 SET 중 에러가 발생할 때', () => {
        it('에러를 삼키고 결과를 정상 반환한다', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockCacheSet.mockRejectedValueOnce(new Error('Redis write error'));
            const symbolResult = makeResult('AAPL');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);

            const result = await searchTickerAction('AAPL');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(result).toHaveLength(1);
        });
    });

    describe('waitUntil로 등록된 translateAndCache 중 에러가 발생할 때', () => {
        it('에러를 삼키고 결과를 정상 반환한다', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockSearchBySymbol.mockResolvedValueOnce([makeResult('UNKNOWN')]);
            mockSearchByName.mockResolvedValueOnce([]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockRejectedValueOnce(
                new Error('translation error')
            );

            const result = await searchTickerAction('UNKNOWN');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(result).toHaveLength(1);
        });
    });

    describe('캐시 provider를 사용할 수 없을 때', () => {
        it('FMP 결과를 직접 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);
            const symbolResult = makeResult('AAPL');
            mockSearchBySymbol.mockResolvedValueOnce([symbolResult]);
            mockSearchByName.mockResolvedValueOnce([]);

            const result = await searchTickerAction('AAPL');
            expect(result).toHaveLength(1);
            expect(result[0].symbol).toBe('AAPL');
        });
    });

    describe('쿼리 케이스 정규화', () => {
        it('소문자로 캐시 키를 생성한다', async () => {
            const cachedResults = [makeResult('AAPL')];
            mockCacheGet.mockImplementation((key: string) => {
                if (key === 'ticker:search:aapl')
                    return Promise.resolve(cachedResults);
                return Promise.resolve(null);
            });

            const result = await searchTickerAction('AAPL');
            expect(result).toEqual(cachedResults);
        });
    });
});
