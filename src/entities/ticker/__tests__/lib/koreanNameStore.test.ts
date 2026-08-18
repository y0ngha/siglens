import type { CacheProvider } from '@y0ngha/siglens-core';
import type { KoreanTickerEntry } from '@/shared/lib/types';
import type { KoreanTickerRepository } from '@/shared/db/types';

const {
    mockCache,
    mockRepository,
    createCacheProviderMock,
    tryGetTickerDatabaseClientMock,
    repositoryFactoryMock,
} = vi.hoisted(() => ({
    mockCache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
    mockRepository: {
        findAll: vi.fn(),
        findBySymbols: vi.fn(),
        upsertMany: vi.fn(),
    },
    createCacheProviderMock: vi.fn(),
    tryGetTickerDatabaseClientMock: vi.fn(),
    repositoryFactoryMock: vi.fn(),
}));

interface FakeDbClient {
    db: unknown;
}

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => createCacheProviderMock(),
}));
vi.mock('../../lib/db', () => ({
    tryGetTickerDatabaseClient: () => tryGetTickerDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleKoreanTickerRepository: class {
        constructor(db: unknown) {
            return repositoryFactoryMock(db) as unknown as object;
        }
    },
}));

import {
    getKoreanNames,
    invalidateKoreanTickerCache,
    searchByKoreanName,
    setKoreanTickers,
} from '../../lib/koreanNameStore';

const apple: KoreanTickerEntry = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    koreanName: '애플',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const microsoft: KoreanTickerEntry = {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    koreanName: '마이크로소프트',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const fakeDbClient: FakeDbClient = { db: {} };

function resetMocks(): void {
    mockCache.get.mockReset();
    mockCache.set.mockReset();
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockReset();
    mockRepository.findAll.mockReset();
    mockRepository.findBySymbols.mockReset();
    mockRepository.findBySymbols.mockResolvedValue([]);
    mockRepository.upsertMany.mockReset();
    mockRepository.upsertMany.mockResolvedValue(undefined);
    createCacheProviderMock.mockReset();
    createCacheProviderMock.mockReturnValue(
        mockCache as unknown as CacheProvider
    );
    tryGetTickerDatabaseClientMock.mockReset();
    tryGetTickerDatabaseClientMock.mockReturnValue(fakeDbClient);
    repositoryFactoryMock.mockReset();
    repositoryFactoryMock.mockReturnValue(
        mockRepository as unknown as KoreanTickerRepository
    );
}

describe('searchByKoreanName', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('cache hit 시 cache 결과로 검색한다', async () => {
        mockCache.get.mockResolvedValue([apple, microsoft]);
        const result = await searchByKoreanName('애');
        expect(result).toHaveLength(1);
        // 전 필드를 고정한다 — `symbol`만 단언하면 name↔koreanName,
        // exchange↔exchangeFullName을 맞바꿔도 통과한다(감사 라운드 12).
        // 이 매퍼가 한글 질의 분기의 유일한 생산자라 그 값이 자동완성 드롭다운에
        // 그대로 렌더된다.
        expect(result[0]).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            exchange: 'NASDAQ',
            exchangeFullName: 'NASDAQ Global Select',
        });
        expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it('한국 종목에는 marketProfile을 붙인다 — 미국 종목에는 안 붙인다', async () => {
        // 행에 프로필 컬럼이 없어 심볼 형상으로 판정한다. 빠지면 한글 검색으로
        // 찾은 한국 종목이 us-equity로 표시된다.
        mockCache.get.mockResolvedValue([
            apple,
            {
                symbol: '005930.KS',
                name: 'Samsung Electronics',
                koreanName: '삼성전자',
                exchange: 'KSC',
                exchangeFullName: 'KOSPI',
            },
        ]);

        const [kr] = await searchByKoreanName('삼성');
        expect(kr).toEqual({
            symbol: '005930.KS',
            name: 'Samsung Electronics',
            koreanName: '삼성전자',
            exchange: 'KSC',
            exchangeFullName: 'KOSPI',
            marketProfile: 'kr-equity',
        });

        const [us] = await searchByKoreanName('애');
        expect(us).not.toHaveProperty('marketProfile');
    });

    it('cache miss(null) 시 DB 조회 후 cache 갱신', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findAll.mockResolvedValue([apple]);
        const result = await searchByKoreanName('애');
        expect(result[0].symbol).toBe('AAPL');
        expect(createCacheProviderMock).toHaveBeenCalledTimes(1);
        expect(mockCache.set).toHaveBeenCalledWith(
            'korean:tickers',
            [apple],
            expect.any(Number)
        );
    });

    it('cache get 실패 시 DB 로 폴백한다', async () => {
        mockCache.get.mockRejectedValue(new Error('cache down'));
        mockRepository.findAll.mockResolvedValue([apple]);
        const result = await searchByKoreanName('애');
        expect(result[0].symbol).toBe('AAPL');
    });

    it('cache 와 DB 모두 비어있으면 빈 배열', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findAll.mockResolvedValue([]);
        await expect(searchByKoreanName('애')).resolves.toEqual([]);
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('cache miss 후 DB 조회 실패 시 빈 배열로 degrade 한다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findAll.mockRejectedValue(new Error('db down'));
        await expect(searchByKoreanName('애')).resolves.toEqual([]);
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('DB 클라이언트 없고 cache 도 없으면 빈 배열', async () => {
        createCacheProviderMock.mockReturnValue(null);
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        await expect(searchByKoreanName('애')).resolves.toEqual([]);
    });

    it('DB 클라이언트 없고 cache 미스면 빈 배열', async () => {
        mockCache.get.mockResolvedValue(null);
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        await expect(searchByKoreanName('애')).resolves.toEqual([]);
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('cache write 실패는 DB 결과 반환을 막지 않는다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findAll.mockResolvedValue([apple]);
        mockCache.set.mockRejectedValue(new Error('cache write down'));
        const result = await searchByKoreanName('애');
        expect(result[0].symbol).toBe('AAPL');
    });
});

describe('getKoreanNames', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('빈 symbols 입력은 cache 호출 없이 빈 객체 반환', async () => {
        await expect(getKoreanNames([])).resolves.toEqual({});
        expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('cache 결과에서 매핑된 symbol 만 반환', async () => {
        mockCache.get.mockResolvedValue([apple, microsoft]);
        const result = await getKoreanNames(['AAPL', 'TSLA']);
        expect(result).toEqual({ AAPL: '애플' });
    });

    it('cache miss 시 DB 결과를 매핑한다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbols.mockResolvedValue([microsoft]);
        const result = await getKoreanNames(['MSFT']);
        expect(result).toEqual({ MSFT: '마이크로소프트' });
        expect(mockRepository.findBySymbols).toHaveBeenCalledWith(['MSFT']);
        expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it('cache miss 후 DB symbol 조회 실패 시 빈 객체로 degrade 한다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbols.mockRejectedValue(new Error('db down'));
        await expect(getKoreanNames(['MSFT'])).resolves.toEqual({});
    });

    it('cache miss + DB 클라이언트 없으면 빈 객체 반환', async () => {
        mockCache.get.mockResolvedValue(null);
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        await expect(getKoreanNames(['AAPL'])).resolves.toEqual({});
        expect(mockRepository.findBySymbols).not.toHaveBeenCalled();
    });
});

/**
 * `loadEntriesBySymbols`가 캐시 hit에서도 상폐 심볼을 놓치지 않는지 검증한다.
 * 캐시는 `findAll()`(상장 종목만)로 채워지므로, 캐시 hit에서 단순 filter만 하면
 * 상폐 종목의 한글명이 영원히 사라진다 — `KoreanTickerRepository.findBySymbols`가
 * 상폐 행까지 돌려주도록 만든 목적을 캐시가 조용히 무력화하는 회귀를 이 블록이 잡는다.
 */
describe('getKoreanNames — 캐시 hit + 상폐 종목 DB 폴백', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    const samsung: KoreanTickerEntry = {
        symbol: '005930.KS',
        name: 'Samsung Electronics',
        koreanName: '삼성전자',
        exchange: 'KSC',
        exchangeFullName: 'KOSPI',
    };

    const delistedKr: KoreanTickerEntry = {
        symbol: '000000.KQ',
        name: 'Delisted Co',
        koreanName: '상폐기업',
        exchange: 'KOQ',
        exchangeFullName: 'KOSDAQ',
    };

    it('캐시가 요청 심볼을 전부 커버하면 findBySymbols 를 호출하지 않는다', async () => {
        mockCache.get.mockResolvedValue([apple, samsung]);
        const result = await getKoreanNames(['AAPL', '005930.KS']);
        expect(result).toEqual({ AAPL: '애플', '005930.KS': '삼성전자' });
        expect(mockRepository.findBySymbols).not.toHaveBeenCalled();
    });

    it('캐시에 없는 KR 심볼은 findBySymbols 로 보충하고 병합한다', async () => {
        mockCache.get.mockResolvedValue([apple]);
        mockRepository.findBySymbols.mockResolvedValue([delistedKr]);

        const result = await getKoreanNames(['AAPL', '000000.KQ']);

        expect(mockRepository.findBySymbols).toHaveBeenCalledWith([
            '000000.KQ',
        ]);
        expect(result).toEqual({ AAPL: '애플', '000000.KQ': '상폐기업' });
    });

    it('캐시에 없는 US/crypto 심볼은 findBySymbols 를 호출하지 않는다', async () => {
        mockCache.get.mockResolvedValue([apple]);

        const result = await getKoreanNames(['AAPL', 'TSLA']);

        expect(mockRepository.findBySymbols).not.toHaveBeenCalled();
        expect(result).toEqual({ AAPL: '애플' });
    });

    it('입력에 중복 심볼이 있어도 KR 폴백 조회는 한 번만 한다', async () => {
        mockCache.get.mockResolvedValue([apple]);
        mockRepository.findBySymbols.mockResolvedValue([delistedKr]);

        const result = await getKoreanNames(['000000.KQ', 'AAPL', '000000.KQ']);

        expect(mockRepository.findBySymbols).toHaveBeenCalledTimes(1);
        expect(mockRepository.findBySymbols).toHaveBeenCalledWith([
            '000000.KQ',
        ]);
        expect(result).toEqual({ AAPL: '애플', '000000.KQ': '상폐기업' });
    });
});

describe('setKoreanTickers', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('빈 배열은 DB / cache 호출 없이 종료한다', async () => {
        await setKoreanTickers([]);
        expect(mockRepository.upsertMany).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('DB upsert 후 전체 cache 를 무효화한다', async () => {
        await setKoreanTickers([apple]);
        expect(mockRepository.upsertMany).toHaveBeenCalledWith([apple]);
        expect(mockCache.delete).toHaveBeenCalledWith('korean:tickers');
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('DB upsert 후 cache 삭제 실패는 흡수한다', async () => {
        mockCache.delete.mockRejectedValue(new Error('cache down'));
        await expect(setKoreanTickers([apple])).resolves.toBeUndefined();
        expect(mockRepository.upsertMany).toHaveBeenCalledWith([apple]);
    });

    it('DB 클라이언트 없으면 DB / cache 호출 없이 종료', async () => {
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        await setKoreanTickers([apple]);
        expect(mockRepository.upsertMany).not.toHaveBeenCalled();
        expect(mockCache.delete).not.toHaveBeenCalled();
    });

    it('DB upsert 실패 시 cache 도 건드리지 않고 종료', async () => {
        mockRepository.upsertMany.mockRejectedValue(new Error('db down'));
        await setKoreanTickers([apple]);
        expect(mockCache.delete).not.toHaveBeenCalled();
    });

    it('cache provider 가 null 이면 DB 만 갱신', async () => {
        createCacheProviderMock.mockReturnValue(null);
        await setKoreanTickers([apple]);
        expect(mockRepository.upsertMany).toHaveBeenCalledTimes(1);
        expect(mockCache.delete).not.toHaveBeenCalled();
    });
});

describe('invalidateKoreanTickerCache', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('cache provider 가 없으면 아무것도 하지 않는다', async () => {
        createCacheProviderMock.mockReturnValue(null);
        await expect(invalidateKoreanTickerCache()).resolves.toBeUndefined();
        expect(mockCache.delete).not.toHaveBeenCalled();
    });

    it('cache 가 있으면 korean:tickers 키를 지운다', async () => {
        await invalidateKoreanTickerCache();
        expect(mockCache.delete).toHaveBeenCalledWith('korean:tickers');
    });

    it('cache delete 실패는 흡수한다', async () => {
        mockCache.delete.mockRejectedValue(new Error('cache down'));
        await expect(invalidateKoreanTickerCache()).resolves.toBeUndefined();
    });
});
