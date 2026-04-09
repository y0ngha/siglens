import {
    searchByKoreanName,
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import type { KoreanTickerEntry } from '@/domain/types';

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: jest.fn(),
}));

import { createCacheProvider } from '@/infrastructure/cache/redis';

const mockCreateCacheProvider = createCacheProvider as jest.Mock;

const makeEntry = (
    overrides: Partial<KoreanTickerEntry> = {}
): KoreanTickerEntry => ({
    symbol: 'AAPL',
    koreanName: '애플',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
    ...overrides,
});

describe('searchByKoreanName', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCacheProvider.mockReturnValue({
            get: mockGet,
            set: mockSet,
            delete: mockDelete,
        });
    });

    describe('캐시에 데이터가 있고 쿼리와 일치할 때', () => {
        it('일치하는 결과를 반환한다', async () => {
            const entries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
                makeEntry({ symbol: 'NVDA', koreanName: '엔비디아' }),
            ];
            mockGet.mockResolvedValueOnce(entries);

            const results = await searchByKoreanName('애플');
            expect(results).toHaveLength(1);
            expect(results[0].symbol).toBe('AAPL');
            expect(results[0].koreanName).toBe('애플');
        });
    });

    describe('캐시에 데이터가 있고 쿼리와 일치하지 않을 때', () => {
        it('빈 배열을 반환한다', async () => {
            const entries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            mockGet.mockResolvedValueOnce(entries);

            const results = await searchByKoreanName('테슬라');
            expect(results).toEqual([]);
        });
    });

    describe('캐시에 데이터가 없을 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockGet.mockResolvedValueOnce(null);

            const results = await searchByKoreanName('애플');
            expect(results).toEqual([]);
        });
    });

    describe('캐시 provider를 사용할 수 없을 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);

            const results = await searchByKoreanName('애플');
            expect(results).toEqual([]);
        });
    });

    describe('캐시 조회 중 에러가 발생할 때', () => {
        it('빈 배열을 반환한다', async () => {
            mockGet.mockRejectedValueOnce(new Error('Redis connection error'));

            const results = await searchByKoreanName('애플');
            expect(results).toEqual([]);
        });
    });

    describe('쿼리가 대소문자를 구분하지 않을 때', () => {
        it('대소문자 무관하게 일치하는 결과를 반환한다', async () => {
            const entries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            mockGet.mockResolvedValueOnce(entries);

            const results = await searchByKoreanName('애');
            expect(results).toHaveLength(1);
        });
    });
});

describe('getKoreanNames', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCacheProvider.mockReturnValue({
            get: mockGet,
            set: mockSet,
            delete: mockDelete,
        });
    });

    describe('빈 symbols 배열일 때', () => {
        it('빈 객체를 반환한다', async () => {
            const result = await getKoreanNames([]);
            expect(result).toEqual({});
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('캐시에 데이터가 있고 symbols와 일치할 때', () => {
        it('심볼과 한국어 이름의 맵을 반환한다', async () => {
            const entries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
                makeEntry({ symbol: 'NVDA', koreanName: '엔비디아' }),
                makeEntry({ symbol: 'TSLA', koreanName: '테슬라' }),
            ];
            mockGet.mockResolvedValueOnce(entries);

            const result = await getKoreanNames(['AAPL', 'NVDA']);
            expect(result).toEqual({
                AAPL: '애플',
                NVDA: '엔비디아',
            });
        });
    });

    describe('캐시에 데이터가 있지만 일부 symbols만 일치할 때', () => {
        it('일치하는 심볼만 포함된 맵을 반환한다', async () => {
            const entries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            mockGet.mockResolvedValueOnce(entries);

            const result = await getKoreanNames(['AAPL', 'UNKNOWN']);
            expect(result).toEqual({ AAPL: '애플' });
        });
    });

    describe('캐시 provider를 사용할 수 없을 때', () => {
        it('빈 객체를 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);

            const result = await getKoreanNames(['AAPL']);
            expect(result).toEqual({});
        });
    });

    describe('캐시 조회 중 에러가 발생할 때', () => {
        it('빈 객체를 반환한다', async () => {
            mockGet.mockRejectedValueOnce(new Error('Redis connection error'));

            const result = await getKoreanNames(['AAPL']);
            expect(result).toEqual({});
        });
    });
});

describe('setKoreanTickers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCacheProvider.mockReturnValue({
            get: mockGet,
            set: mockSet,
            delete: mockDelete,
        });
    });

    describe('빈 배열을 전달할 때', () => {
        it('아무 동작도 하지 않는다', async () => {
            await setKoreanTickers([]);
            expect(mockGet).not.toHaveBeenCalled();
            expect(mockSet).not.toHaveBeenCalled();
        });
    });

    describe('기존 데이터가 없을 때', () => {
        it('새 항목을 저장한다', async () => {
            mockGet.mockResolvedValueOnce(null);
            mockSet.mockResolvedValueOnce(undefined);

            const newEntries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            await setKoreanTickers(newEntries);

            expect(mockSet).toHaveBeenCalledWith(
                expect.any(String),
                newEntries,
                expect.any(Number)
            );
        });
    });

    describe('기존 데이터가 있고 새 항목이 추가될 때', () => {
        it('기존 항목과 새 항목을 병합하여 저장한다', async () => {
            const existing: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            mockGet.mockResolvedValueOnce(existing);
            mockSet.mockResolvedValueOnce(undefined);

            const newEntries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'NVDA', koreanName: '엔비디아' }),
            ];
            await setKoreanTickers(newEntries);

            const savedData = mockSet.mock.calls[0][1] as KoreanTickerEntry[];
            expect(savedData).toHaveLength(2);
            expect(savedData.map(e => e.symbol)).toContain('AAPL');
            expect(savedData.map(e => e.symbol)).toContain('NVDA');
        });
    });

    describe('기존 항목과 동일한 심볼이 있을 때', () => {
        it('새 항목으로 덮어쓴다', async () => {
            const existing: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '구 애플' }),
            ];
            mockGet.mockResolvedValueOnce(existing);
            mockSet.mockResolvedValueOnce(undefined);

            const newEntries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '새 애플' }),
            ];
            await setKoreanTickers(newEntries);

            const savedData = mockSet.mock.calls[0][1] as KoreanTickerEntry[];
            expect(savedData).toHaveLength(1);
            expect(savedData[0].koreanName).toBe('새 애플');
        });
    });

    describe('캐시 provider를 사용할 수 없을 때', () => {
        it('아무 동작도 하지 않는다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);

            const newEntries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            await setKoreanTickers(newEntries);

            expect(mockGet).not.toHaveBeenCalled();
            expect(mockSet).not.toHaveBeenCalled();
        });
    });

    describe('캐시 저장 중 에러가 발생할 때', () => {
        it('에러를 삼키고 종료한다', async () => {
            mockGet.mockResolvedValueOnce([]);
            mockSet.mockRejectedValueOnce(new Error('Redis write error'));

            const newEntries: KoreanTickerEntry[] = [
                makeEntry({ symbol: 'AAPL', koreanName: '애플' }),
            ];
            await expect(setKoreanTickers(newEntries)).resolves.not.toThrow();
        });
    });
});
