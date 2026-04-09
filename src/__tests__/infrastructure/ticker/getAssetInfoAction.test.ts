import type { AssetInfo } from '@/domain/types';

jest.mock('react', () => ({
    cache: (fn: unknown) => fn,
}));

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();

jest.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: jest.fn(),
}));

jest.mock('@/infrastructure/ticker/fmpTickerApi', () => ({
    searchBySymbol: jest.fn(),
    filterUsExchanges: jest.fn((results: unknown[]) => results),
}));

jest.mock('@/infrastructure/ticker/koreanNameStore', () => ({
    getKoreanNames: jest.fn(),
    setKoreanTickers: jest.fn(),
}));

jest.mock('@/infrastructure/ticker/koreanTranslator', () => ({
    translateCompanyNames: jest.fn(),
}));

import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    searchBySymbol,
    filterUsExchanges,
} from '@/infrastructure/ticker/fmpTickerApi';
import {
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';

const mockCreateCacheProvider = createCacheProvider as jest.Mock;
const mockSearchBySymbol = searchBySymbol as jest.Mock;
const mockFilterUsExchanges = filterUsExchanges as jest.Mock;
const mockGetKoreanNames = getKoreanNames as jest.Mock;
const mockSetKoreanTickers = setKoreanTickers as jest.Mock;
const mockTranslateCompanyNames = translateCompanyNames as jest.Mock;

const makeFmpResult = (symbol: string) => ({
    symbol,
    name: `${symbol} Inc`,
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
});

describe('getAssetInfoAction', () => {
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
        mockSearchBySymbol.mockResolvedValue([]);
        mockGetKoreanNames.mockResolvedValue({});
        mockTranslateCompanyNames.mockResolvedValue({});
        mockSetKoreanTickers.mockResolvedValue(undefined);
        mockCacheGet.mockResolvedValue(null);
        mockCacheSet.mockResolvedValue(undefined);
    });

    describe('캐시 히트일 때', () => {
        it('캐시된 결과를 즉시 반환한다', async () => {
            const cached: AssetInfo = {
                symbol: 'AAPL',
                name: 'Apple Inc',
                koreanName: '애플',
            };
            mockCacheGet.mockResolvedValueOnce(cached);

            const result = await getAssetInfoAction('AAPL');
            expect(result).toEqual(cached);
            expect(mockSearchBySymbol).not.toHaveBeenCalled();
        });
    });

    describe('캐시 미스이고 FMP에서 정확히 매칭되는 심볼이 있을 때', () => {
        it('한국어명이 있으면 koreanName을 포함해서 반환한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('AAPL')]);
            mockGetKoreanNames.mockResolvedValueOnce({ AAPL: '애플' });

            const result = await getAssetInfoAction('AAPL');
            expect(result.symbol).toBe('AAPL');
            expect(result.name).toBe('AAPL Inc');
            expect(result.koreanName).toBe('애플');
        });

        it('한국어명이 없으면 koreanName 없이 반환한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('IONQ')]);
            mockGetKoreanNames.mockResolvedValueOnce({});

            const result = await getAssetInfoAction('IONQ');
            expect(result.symbol).toBe('IONQ');
            expect(result.koreanName).toBeUndefined();
        });

        it('한국어명이 없으면 translateAndCache를 fire-and-forget으로 호출한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('IONQ')]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockResolvedValue({ IONQ: '아이온큐' });

            await getAssetInfoAction('IONQ');

            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockTranslateCompanyNames).toHaveBeenCalledWith([
                { symbol: 'IONQ', name: 'IONQ Inc' },
            ]);
        });

        it('결과를 캐시에 저장한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('AAPL')]);
            mockGetKoreanNames.mockResolvedValueOnce({ AAPL: '애플' });

            await getAssetInfoAction('AAPL');
            expect(mockCacheSet).toHaveBeenCalled();
        });

        it('소문자 심볼 입력을 대문자로 정규화한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('AAPL')]);
            mockGetKoreanNames.mockResolvedValueOnce({});

            const result = await getAssetInfoAction('aapl');
            expect(result.symbol).toBe('AAPL');
            expect(mockSearchBySymbol).toHaveBeenCalledWith('AAPL');
        });
    });

    describe('FMP 결과에 정확히 일치하는 심볼이 없을 때', () => {
        it('첫 번째 US 거래소 결과를 사용한다', async () => {
            const otherResult = makeFmpResult('AAPL.A');
            mockSearchBySymbol.mockResolvedValueOnce([otherResult]);
            mockGetKoreanNames.mockResolvedValueOnce({});

            const result = await getAssetInfoAction('AAPL');
            expect(result.name).toBe('AAPL.A Inc');
        });
    });

    describe('FMP 결과가 없을 때', () => {
        it('symbol을 name 폴백으로 사용한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([]);

            const result = await getAssetInfoAction('UNKNOWN');
            expect(result.symbol).toBe('UNKNOWN');
            expect(result.name).toBe('UNKNOWN');
            expect(result.koreanName).toBeUndefined();
        });

        it('translateAndCache를 호출하지 않는다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([]);

            await getAssetInfoAction('UNKNOWN');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockTranslateCompanyNames).not.toHaveBeenCalled();
        });
    });

    describe('캐시 provider를 사용할 수 없을 때', () => {
        it('FMP 결과를 직접 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('AAPL')]);
            mockGetKoreanNames.mockResolvedValueOnce({ AAPL: '애플' });

            const result = await getAssetInfoAction('AAPL');
            expect(result.symbol).toBe('AAPL');
            expect(result.koreanName).toBe('애플');
        });
    });

    describe('캐시 GET 중 에러가 발생할 때', () => {
        it('에러를 삼키고 FMP API를 호출한다', async () => {
            mockCacheGet.mockRejectedValueOnce(new Error('Redis error'));
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('AAPL')]);
            mockGetKoreanNames.mockResolvedValueOnce({});

            const result = await getAssetInfoAction('AAPL');
            expect(result.symbol).toBe('AAPL');
            expect(mockSearchBySymbol).toHaveBeenCalled();
        });
    });

    describe('캐시 SET 중 에러가 발생할 때', () => {
        it('에러를 삼키고 결과를 정상 반환한다', async () => {
            mockCacheSet.mockRejectedValueOnce(new Error('Redis write error'));
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('AAPL')]);
            mockGetKoreanNames.mockResolvedValueOnce({});

            const result = await getAssetInfoAction('AAPL');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(result.symbol).toBe('AAPL');
        });
    });

    describe('translateAndCache 중 에러가 발생할 때', () => {
        it('에러를 삼키고 결과를 정상 반환한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('IONQ')]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockRejectedValueOnce(
                new Error('translation failed')
            );

            const result = await getAssetInfoAction('IONQ');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(result.symbol).toBe('IONQ');
        });
    });

    describe('번역 후 setKoreanTickers 호출', () => {
        it('번역 결과를 KoreanTickerEntry로 저장한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('IONQ')]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockResolvedValue({ IONQ: '아이온큐' });

            await getAssetInfoAction('IONQ');
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockSetKoreanTickers).toHaveBeenCalledWith([
                expect.objectContaining({
                    symbol: 'IONQ',
                    koreanName: '아이온큐',
                }),
            ]);
        });

        it('번역 완료 후 AssetInfo 캐시를 koreanName과 함께 갱신한다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('IONQ')]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockResolvedValue({ IONQ: '아이온큐' });

            await getAssetInfoAction('IONQ');
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockCacheSet).toHaveBeenCalledWith(
                expect.stringContaining('IONQ'),
                expect.objectContaining({ koreanName: '아이온큐' }),
                expect.any(Number)
            );
        });

        it('번역 결과가 비어있으면 setKoreanTickers를 호출하지 않는다', async () => {
            mockSearchBySymbol.mockResolvedValueOnce([makeFmpResult('IONQ')]);
            mockGetKoreanNames.mockResolvedValueOnce({});
            mockTranslateCompanyNames.mockResolvedValue({});

            await getAssetInfoAction('IONQ');
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockSetKoreanTickers).not.toHaveBeenCalled();
        });
    });
});
