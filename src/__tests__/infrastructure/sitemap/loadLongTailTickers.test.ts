jest.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: jest.fn(),
}));

jest.mock('@/infrastructure/db/tickerRepository', () => ({
    DrizzleKoreanTickerRepository: jest.fn(),
}));

import { POPULAR_TICKERS } from '@/domain/constants/popular-tickers';
import type { KoreanTickerEntry } from '@/domain/types';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleKoreanTickerRepository } from '@/infrastructure/db/tickerRepository';
import { loadLongTailTickers } from '@/infrastructure/sitemap/loadLongTailTickers';

// POPULAR_TICKERS가 변경돼도 본 테스트의 dedupe 검증이 의도와 어긋나지 않도록
// 생산 코드의 상수에서 직접 샘플을 가져온다 (MISTAKES.md Tests §4 정신: 경계
// 상수는 hardcode하지 말고 생산 코드에서 import).
const POPULAR_SAMPLE_1 = POPULAR_TICKERS[0];
const POPULAR_SAMPLE_2 = POPULAR_TICKERS[1];

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
                            makeEntry(POPULAR_SAMPLE_1),
                            makeEntry(POPULAR_SAMPLE_2),
                            makeEntry('LONGTAIL1'),
                            makeEntry('LONGTAIL2'),
                        ]),
                }) as unknown as DrizzleKoreanTickerRepository
        );

        const result = await loadLongTailTickers();
        expect(result).toEqual(['LONGTAIL1', 'LONGTAIL2']);
    });

    it('DB row symbol이 소문자/혼합 대소문자여도 toUpperCase로 정규화한다', async () => {
        // 정규화하지 않으면 소문자 POPULAR 심볼은 Set.has 매칭 실패 → sitemap에
        // 중복 엔트리(/AAPL + /aapl 형태) 생성 위험. 회귀 방어 케이스.
        mockedTryGetDatabaseClient.mockReturnValue({
            db: {} as never,
            sql: {} as never,
        });
        MockedRepository.mockImplementation(
            () =>
                ({
                    findAll: jest.fn().mockResolvedValue([
                        makeEntry(POPULAR_SAMPLE_1.toLowerCase()), // 소문자 POPULAR → 제외
                        makeEntry(
                            POPULAR_SAMPLE_2.charAt(0) +
                                POPULAR_SAMPLE_2.slice(1).toLowerCase()
                        ), // 혼합 POPULAR → 제외
                        makeEntry('newticker'),
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
