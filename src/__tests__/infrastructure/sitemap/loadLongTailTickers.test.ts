jest.mock('@/infrastructure/db/client', () => ({
    tryGetDatabaseClient: jest.fn(),
}));

jest.mock('@/infrastructure/db/tickerRepository', () => ({
    DrizzleKoreanTickerRepository: jest.fn(),
}));

import type { KoreanTickerEntry } from '@/domain/types';
import { tryGetDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleKoreanTickerRepository } from '@/infrastructure/db/tickerRepository';
import { loadLongTailTickers } from '@/infrastructure/sitemap/loadLongTailTickers';

const mockedTryGetDatabaseClient = tryGetDatabaseClient as jest.MockedFunction<
    typeof tryGetDatabaseClient
>;
const MockedRepository = DrizzleKoreanTickerRepository as jest.MockedClass<
    typeof DrizzleKoreanTickerRepository
>;

function makeEntry(symbol: string): KoreanTickerEntry {
    return {
        symbol,
        name: `${symbol} Inc.`,
        koreanName: `${symbol} 한국명`,
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    };
}

describe('loadLongTailTickers', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('DB client가 null이면 빈 배열을 반환한다 (graceful degradation)', async () => {
        mockedTryGetDatabaseClient.mockReturnValue(null);
        await expect(loadLongTailTickers()).resolves.toEqual([]);
        expect(MockedRepository).not.toHaveBeenCalled();
    });

    it('DB 조회에서 예외가 발생하면 error 로깅 후 빈 배열을 반환한다', async () => {
        mockedTryGetDatabaseClient.mockReturnValue({
            db: {} as never,
            sql: {} as never,
        });
        MockedRepository.mockImplementation(
            () =>
                ({
                    findAll: jest
                        .fn()
                        .mockRejectedValue(new Error('DB connection failed')),
                }) as unknown as DrizzleKoreanTickerRepository
        );

        await expect(loadLongTailTickers()).resolves.toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[sitemap] loadLongTailTickers failed:',
            expect.any(Error)
        );
    });

    it('POPULAR_TICKERS와 중복되는 심볼은 결과에서 제외한다', async () => {
        // POPULAR_TICKERS는 hardcoded uppercase. AAPL/MSFT는 popular에 포함되어 있다.
        mockedTryGetDatabaseClient.mockReturnValue({
            db: {} as never,
            sql: {} as never,
        });
        MockedRepository.mockImplementation(
            () =>
                ({
                    findAll: jest
                        .fn()
                        .mockResolvedValue([
                            makeEntry('AAPL'),
                            makeEntry('MSFT'),
                            makeEntry('LONGTAIL1'),
                            makeEntry('LONGTAIL2'),
                        ]),
                }) as unknown as DrizzleKoreanTickerRepository
        );

        const result = await loadLongTailTickers();
        expect(result).toEqual(['LONGTAIL1', 'LONGTAIL2']);
    });

    it('DB row symbol이 소문자/혼합 대소문자여도 toUpperCase로 정규화한다', async () => {
        // 정규화하지 않으면 'aapl'은 POPULAR_TICKERS('AAPL')와 매칭 안 돼 sitemap에
        // 중복 엔트리(/AAPL + /aapl) 생성 위험. 회귀 방어 케이스.
        mockedTryGetDatabaseClient.mockReturnValue({
            db: {} as never,
            sql: {} as never,
        });
        MockedRepository.mockImplementation(
            () =>
                ({
                    findAll: jest.fn().mockResolvedValue([
                        makeEntry('aapl'), // 소문자 POPULAR → 제외돼야 함
                        makeEntry('Msft'), // 혼합 → 제외돼야 함
                        makeEntry('newticker'), // 소문자 long-tail
                        makeEntry('MixedCase'),
                    ]),
                }) as unknown as DrizzleKoreanTickerRepository
        );

        const result = await loadLongTailTickers();
        expect(result).toEqual(['NEWTICKER', 'MIXEDCASE']);
    });

    it('POPULAR_TICKERS 외 종목만 있으면 모두 반환한다 (uppercase)', async () => {
        mockedTryGetDatabaseClient.mockReturnValue({
            db: {} as never,
            sql: {} as never,
        });
        MockedRepository.mockImplementation(
            () =>
                ({
                    findAll: jest
                        .fn()
                        .mockResolvedValue([
                            makeEntry('OBSCURE1'),
                            makeEntry('OBSCURE2'),
                        ]),
                }) as unknown as DrizzleKoreanTickerRepository
        );

        const result = await loadLongTailTickers();
        expect(result).toEqual(['OBSCURE1', 'OBSCURE2']);
    });

    it('DB가 빈 배열을 반환하면 빈 배열을 반환한다', async () => {
        mockedTryGetDatabaseClient.mockReturnValue({
            db: {} as never,
            sql: {} as never,
        });
        MockedRepository.mockImplementation(
            () =>
                ({
                    findAll: jest.fn().mockResolvedValue([]),
                }) as unknown as DrizzleKoreanTickerRepository
        );

        await expect(loadLongTailTickers()).resolves.toEqual([]);
    });
});
