import type { CacheProvider } from '@y0ngha/siglens-core';
import type { KoreanTickerEntry } from '@/shared/lib/types';
import type { KoreanTickerRepository } from '@/shared/db/types';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';

const {
    mockCache,
    mockRepository,
    createCacheProviderMock,
    tryGetDatabaseClientMock,
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
    tryGetDatabaseClientMock: vi.fn(),
    repositoryFactoryMock: vi.fn(),
}));

interface FakeDbClient {
    db: unknown;
}

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => createCacheProviderMock(),
}));
vi.mock('@/shared/db/client', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/db/client')>()),
    tryGetDatabaseClient: () => tryGetDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleKoreanTickerRepository: class {
        constructor(db: unknown) {
            return repositoryFactoryMock(db) as unknown as object;
        }
    },
}));

import {
    __resetKoreanSearchSnapshotForTests,
    getKoreanNames,
    getTickerDisplayNames,
    invalidateKoreanTickerCache,
    searchByKoreanName,
    setKoreanTickers,
} from '../../lib/koreanNameStore';
import {
    KOREAN_SEARCH_SNAPSHOT_TTL_MS,
    LEGACY_KOREAN_TICKERS_REDIS_KEY,
} from '../../lib/cacheKeys';

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
    __resetKoreanSearchSnapshotForTests();
    mockRepository.findAll.mockReset();
    mockRepository.findAll.mockResolvedValue([]);
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
    tryGetDatabaseClientMock.mockReset();
    tryGetDatabaseClientMock.mockReturnValue(fakeDbClient);
    repositoryFactoryMock.mockReset();
    repositoryFactoryMock.mockReturnValue(
        mockRepository as unknown as KoreanTickerRepository
    );
}

const laes: KoreanTickerEntry = {
    symbol: 'LAES',
    name: 'SEALSQ Corp',
    koreanName: '씰스큐', // 저장된(틀린) 값
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const samsung: KoreanTickerEntry = {
    symbol: '005930.KS',
    name: 'Samsung Electronics',
    koreanName: '삼성전자',
    exchange: 'KSC',
    exchangeFullName: 'KOSPI',
};

describe('searchByKoreanName', () => {
    beforeEach(resetMocks);
    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('DB 스냅샷으로 부분 일치 검색하고 전 필드를 매핑한다', async () => {
        mockRepository.findAll.mockResolvedValue([apple, microsoft]);
        const result = await searchByKoreanName('애');
        expect(result).toHaveLength(1);
        // 전 필드를 고정한다 — `symbol`만 단언하면 name↔koreanName,
        // exchange↔exchangeFullName을 맞바꿔도 통과한다.
        expect(result[0]).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            exchange: 'NASDAQ',
            exchangeFullName: 'NASDAQ Global Select',
        });
    });

    it('스냅샷을 재사용한다 — TTL 안에서는 findAll을 한 번만 호출한다', async () => {
        mockRepository.findAll.mockResolvedValue([apple, microsoft]);

        await searchByKoreanName('애');
        await searchByKoreanName('마이크로');
        await searchByKoreanName('애');

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('TTL이 지나면 다시 로드해 새 행을 반영한다', async () => {
        vi.useFakeTimers();
        mockRepository.findAll.mockResolvedValueOnce([apple]);
        expect(await searchByKoreanName('마이크로')).toEqual([]);

        mockRepository.findAll.mockResolvedValueOnce([apple, microsoft]);
        vi.advanceTimersByTime(KOREAN_SEARCH_SNAPSHOT_TTL_MS - 1);
        expect(await searchByKoreanName('마이크로')).toEqual([]);
        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1);
        const result = await searchByKoreanName('마이크로');
        expect(result.map(r => r.symbol)).toEqual(['MSFT']);
        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('동시에 몰린 첫 요청은 single-flight로 findAll을 한 번만 호출한다', async () => {
        let release: (rows: KoreanTickerEntry[]) => void = () => {};
        mockRepository.findAll.mockReturnValue(
            new Promise<KoreanTickerEntry[]>(resolve => {
                release = resolve;
            })
        );

        const pending = Promise.all([
            searchByKoreanName('애'),
            searchByKoreanName('애'),
            searchByKoreanName('애'),
        ]);
        release([apple]);
        const results = await pending;

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
        expect(results.every(r => r.length === 1)).toBe(true);
    });

    it('빈 결과는 스냅샷에 넣지 않아 다음 요청이 다시 시도한다', async () => {
        mockRepository.findAll.mockResolvedValueOnce([]);
        await expect(searchByKoreanName('애')).resolves.toEqual([]);

        mockRepository.findAll.mockResolvedValueOnce([apple]);
        const result = await searchByKoreanName('애');

        expect(result.map(r => r.symbol)).toEqual(['AAPL']);
        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('DB 조회 실패는 빈 배열로 degrade하고 캐시하지 않는다', async () => {
        mockRepository.findAll.mockRejectedValueOnce(new Error('db down'));
        await expect(searchByKoreanName('애')).resolves.toEqual([]);

        mockRepository.findAll.mockResolvedValueOnce([apple]);
        await expect(searchByKoreanName('애')).resolves.toHaveLength(1);
    });

    describe('만료 뒤 갱신 실패 — 마지막 정상 스냅샷 서빙(stale-on-error)', () => {
        async function loadThenExpire(): Promise<void> {
            vi.useFakeTimers();
            mockRepository.findAll.mockResolvedValueOnce([apple]);
            await searchByKoreanName('애');
            vi.advanceTimersByTime(KOREAN_SEARCH_SNAPSHOT_TTL_MS);
        }

        it('갱신 중 DB가 던지면 이전 항목을 돌려준다', async () => {
            await loadThenExpire();
            mockRepository.findAll.mockRejectedValueOnce(new Error('db down'));

            const result = await searchByKoreanName('애');

            expect(result.map(r => r.symbol)).toEqual(['AAPL']);
        });

        it('갱신 결과가 비어 있어도 이전 항목을 돌려준다', async () => {
            await loadThenExpire();
            mockRepository.findAll.mockResolvedValueOnce([]);

            const result = await searchByKoreanName('애');

            expect(result.map(r => r.symbol)).toEqual(['AAPL']);
        });

        it('실패한 갱신은 만료를 연장하지 않아 다음 호출이 DB를 다시 읽는다', async () => {
            await loadThenExpire();
            mockRepository.findAll.mockRejectedValueOnce(new Error('db down'));
            await searchByKoreanName('애');
            expect(mockRepository.findAll).toHaveBeenCalledTimes(2);

            mockRepository.findAll.mockResolvedValueOnce([apple, microsoft]);
            const recovered = await searchByKoreanName('마이크로');

            expect(mockRepository.findAll).toHaveBeenCalledTimes(3);
            expect(recovered.map(r => r.symbol)).toEqual(['MSFT']);
        });

        it('스냅샷이 한 번도 없었다면 빈 배열이다', async () => {
            mockRepository.findAll.mockRejectedValueOnce(new Error('db down'));
            await expect(searchByKoreanName('애')).resolves.toEqual([]);
        });
    });

    it('DB 클라이언트가 없으면 빈 배열', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        await expect(searchByKoreanName('애')).resolves.toEqual([]);
        expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it('setKoreanTickers 뒤에는 스냅샷이 무효화돼 새 행이 검색된다', async () => {
        mockRepository.findAll.mockResolvedValueOnce([apple]);
        expect(await searchByKoreanName('마이크로')).toEqual([]);

        await setKoreanTickers([microsoft]);
        mockRepository.findAll.mockResolvedValueOnce([apple, microsoft]);

        const result = await searchByKoreanName('마이크로');
        expect(result.map(r => r.symbol)).toEqual(['MSFT']);
        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('invalidateKoreanTickerCache 뒤에도 스냅샷이 무효화된다', async () => {
        mockRepository.findAll.mockResolvedValueOnce([apple]);
        await searchByKoreanName('애');

        await invalidateKoreanTickerCache();
        mockRepository.findAll.mockResolvedValueOnce([]);
        mockRepository.findAll.mockResolvedValueOnce([apple, microsoft]);

        await searchByKoreanName('애');
        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('로드 도중 무효화가 끼면 그 낡은 결과를 스냅샷에 넣지 않는다', async () => {
        let release: (rows: KoreanTickerEntry[]) => void = () => {};
        mockRepository.findAll.mockReturnValueOnce(
            new Promise<KoreanTickerEntry[]>(resolve => {
                release = resolve;
            })
        );
        const inFlight = searchByKoreanName('애');
        await invalidateKoreanTickerCache();
        release([apple]);
        await inFlight;

        mockRepository.findAll.mockResolvedValueOnce([apple, microsoft]);
        const result = await searchByKoreanName('마이크로');

        expect(result.map(r => r.symbol)).toEqual(['MSFT']);
    });

    it('무효화 뒤에 온 요청은 낡은 진행 중 로드에 합류하지 않고 새로 읽는다', async () => {
        let releaseStale: (rows: KoreanTickerEntry[]) => void = () => {};
        mockRepository.findAll.mockReturnValueOnce(
            new Promise<KoreanTickerEntry[]>(resolve => {
                releaseStale = resolve;
            })
        );
        const stale = searchByKoreanName('애');
        await invalidateKoreanTickerCache();

        mockRepository.findAll.mockResolvedValueOnce([apple, microsoft]);
        const fresh = await searchByKoreanName('마이크로');

        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
        expect(fresh.map(r => r.symbol)).toEqual(['MSFT']);

        // 낡은 로드가 뒤늦게 끝나도 새 스냅샷·새 로드 슬롯을 건드리지 않는다.
        releaseStale([apple]);
        await stale;
        const again = await searchByKoreanName('마이크로');
        expect(again.map(r => r.symbol)).toEqual(['MSFT']);
        expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    /**
     * **매칭 술어와 반환값 둘 다** 정본을 봐야 한다. 반환값만 덮으면 표시만
     * 고쳐지고 검색은 저장된(틀린) 이름으로만 걸린다 — 사용자가 올바른 이름을
     * 치면 0건, 틀린 이름을 쳐야 나오는 상태가 된다. 스냅샷 로드 지점에서 정본을
     * 입히므로 술어가 자동으로 정본을 본다.
     */
    it('올바른 정본 이름으로 검색하면 걸리고 반환값도 정본이다', async () => {
        mockRepository.findAll.mockResolvedValue([laes]);

        const result = await searchByKoreanName('실스큐');

        expect(result).toHaveLength(1);
        expect(result[0].koreanName).toBe('실스큐');
    });

    it('틀린 저장 이름으로는 더 이상 걸리지 않는다', async () => {
        mockRepository.findAll.mockResolvedValue([laes]);
        await expect(searchByKoreanName('씰스큐')).resolves.toEqual([]);
    });

    it('한국 종목에는 marketProfile을 붙인다 — 미국 종목에는 안 붙인다', async () => {
        // 행에 프로필 컬럼이 없어 심볼 형상으로 판정한다. 빠지면 한글 검색으로
        // 찾은 한국 종목이 us-equity로 표시된다.
        mockRepository.findAll.mockResolvedValue([apple, samsung]);

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

    it('Redis를 읽지도 쓰지도 않는다', async () => {
        mockRepository.findAll.mockResolvedValue([apple]);

        await searchByKoreanName('애');

        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });
});

describe('getTickerDisplayNames', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('빈 입력은 DB를 건드리지 않는다', async () => {
        await expect(getTickerDisplayNames([])).resolves.toEqual({});
        expect(mockRepository.findBySymbols).not.toHaveBeenCalled();
    });

    it('DB findBySymbols를 직접 읽어 한글명과 영문명을 함께 돌려준다', async () => {
        mockRepository.findBySymbols.mockResolvedValue([apple, microsoft]);

        await expect(getTickerDisplayNames(['AAPL', 'MSFT'])).resolves.toEqual({
            AAPL: { koreanName: '애플', name: 'Apple Inc.' },
            MSFT: {
                koreanName: '마이크로소프트',
                name: 'Microsoft Corporation',
            },
        });
        expect(mockRepository.findBySymbols).toHaveBeenCalledWith([
            'AAPL',
            'MSFT',
        ]);
        expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it('행이 없는 심볼은 결과에서 빠진다 — 없는 이름을 지어내지 않는다', async () => {
        mockRepository.findBySymbols.mockResolvedValue([apple]);

        const result = await getTickerDisplayNames(['AAPL', 'TSLA']);

        expect(Object.keys(result)).toEqual(['AAPL']);
    });

    /**
     * 정본 한글명은 **행이 없어도** 나와야 한다. `loadEntriesBySymbols`는 존재하는
     * 행만 고칠 수 있어서 이 함수가 `getKoreanNames`와 같은 폴백을 하나 더 갖는다.
     */
    it('저장된 행이 없어도 정본 한글명은 내보낸다', async () => {
        const [canonicalSymbol, canonicalName] = [
            ...CANONICAL_KOREAN_NAMES.entries(),
        ][0];

        const result = await getTickerDisplayNames([canonicalSymbol]);

        expect(result[canonicalSymbol]).toEqual({
            koreanName: canonicalName,
            name: null,
        });
    });

    it('정본 한글명이 저장된 행의 이름을 이긴다', async () => {
        const [canonicalSymbol, canonicalName] = [
            ...CANONICAL_KOREAN_NAMES.entries(),
        ][0];
        mockRepository.findBySymbols.mockResolvedValue([
            {
                symbol: canonicalSymbol,
                name: 'Stored English',
                koreanName: '옛이름',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ]);

        const result = await getTickerDisplayNames([canonicalSymbol]);

        expect(result[canonicalSymbol].koreanName).toBe(canonicalName);
        expect(result[canonicalSymbol].name).toBe('Stored English');
    });

    it('DB가 죽어도 던지지 않고 빈 객체로 떨어진다', async () => {
        mockRepository.findBySymbols.mockRejectedValue(new Error('db down'));

        await expect(getTickerDisplayNames(['MSFT'])).resolves.toEqual({});
    });
});

describe('getKoreanNames', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('빈 symbols 입력은 DB 호출 없이 빈 객체 반환', async () => {
        await expect(getKoreanNames([])).resolves.toEqual({});
        expect(mockRepository.findBySymbols).not.toHaveBeenCalled();
    });

    it('DB 결과에서 매핑된 symbol만 반환한다', async () => {
        mockRepository.findBySymbols.mockResolvedValue([apple]);
        const result = await getKoreanNames(['AAPL', 'TSLA']);
        expect(result).toEqual({ AAPL: '애플' });
        expect(mockRepository.findBySymbols).toHaveBeenCalledWith([
            'AAPL',
            'TSLA',
        ]);
        expect(mockRepository.findAll).not.toHaveBeenCalled();
    });

    it('DB symbol 조회 실패 시 빈 객체로 degrade 한다', async () => {
        mockRepository.findBySymbols.mockRejectedValue(new Error('db down'));
        await expect(getKoreanNames(['MSFT'])).resolves.toEqual({});
    });

    it('DB 클라이언트 없으면 빈 객체 반환', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        await expect(getKoreanNames(['AAPL'])).resolves.toEqual({});
        expect(mockRepository.findBySymbols).not.toHaveBeenCalled();
    });

    /**
     * `korean_tickers`는 `asset_translations`와 **다른 테이블**이라,
     * `getAssetInfo` 출구의 정본 오버라이드가 이 경로에는 닿지 않는다. 검색
     * 자동완성과 뉴스가 여기서 이름을 받으므로, 덮지 않으면 종목 페이지엔
     * `실스큐`, 검색 드롭다운엔 `씰스큐`가 뜬다.
     */
    it('정본 한글명이 저장된 값을 덮는다 (검색 우회 경로 차단)', async () => {
        mockRepository.findBySymbols.mockResolvedValue([laes]);
        await expect(getKoreanNames(['LAES'])).resolves.toEqual({
            LAES: '실스큐',
        });
    });

    it('저장된 행이 없어도 정본은 내보낸다', async () => {
        await expect(getKoreanNames(['QBTS'])).resolves.toEqual({
            QBTS: '디웨이브 퀀텀',
        });
    });

    it('상폐 KR 심볼도 findBySymbols 한 번으로 이름을 얻는다 (별도 보충 없음)', async () => {
        const delistedKr: KoreanTickerEntry = {
            symbol: '000000.KQ',
            name: 'Delisted Co',
            koreanName: '상폐기업',
            exchange: 'KOQ',
            exchangeFullName: 'KOSDAQ',
        };
        mockRepository.findBySymbols.mockResolvedValue([apple, delistedKr]);

        const result = await getKoreanNames(['AAPL', '000000.KQ']);

        expect(result).toEqual({ AAPL: '애플', '000000.KQ': '상폐기업' });
        expect(mockRepository.findBySymbols).toHaveBeenCalledTimes(1);
    });

    it('Redis를 읽지도 쓰지도 않는다', async () => {
        mockRepository.findBySymbols.mockResolvedValue([apple]);
        await getKoreanNames(['AAPL']);
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });
});

describe('setKoreanTickers', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('빈 배열은 DB 호출 없이 종료한다', async () => {
        await setKoreanTickers([]);
        expect(mockRepository.upsertMany).not.toHaveBeenCalled();
    });

    it('DB에 upsert하고 Redis는 건드리지 않는다', async () => {
        await setKoreanTickers([apple]);
        expect(mockRepository.upsertMany).toHaveBeenCalledWith([apple]);
        expect(mockCache.delete).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('DB 클라이언트 없으면 DB 호출 없이 종료', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        await setKoreanTickers([apple]);
        expect(mockRepository.upsertMany).not.toHaveBeenCalled();
    });

    it('DB upsert 실패 시 스냅샷을 비우지 않는다', async () => {
        mockRepository.findAll.mockResolvedValueOnce([apple]);
        await searchByKoreanName('애');
        mockRepository.upsertMany.mockRejectedValue(new Error('db down'));

        await setKoreanTickers([microsoft]);
        await searchByKoreanName('애');

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });
});

describe('invalidateKoreanTickerCache', () => {
    beforeEach(resetMocks);
    afterEach(() => vi.clearAllMocks());

    it('예전 Redis 키만 best-effort로 지운다', async () => {
        await invalidateKoreanTickerCache();
        expect(mockCache.delete).toHaveBeenCalledWith(
            LEGACY_KOREAN_TICKERS_REDIS_KEY
        );
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('cache provider 가 없으면 아무것도 지우지 않고 끝난다', async () => {
        createCacheProviderMock.mockReturnValue(null);
        await expect(invalidateKoreanTickerCache()).resolves.toBeUndefined();
        expect(mockCache.delete).not.toHaveBeenCalled();
    });

    it('cache delete 실패는 흡수한다', async () => {
        mockCache.delete.mockRejectedValue(new Error('cache down'));
        await expect(invalidateKoreanTickerCache()).resolves.toBeUndefined();
    });

    it('예전 키 이름은 운영에 남은 사본과 같은 문자열이다', () => {
        expect(LEGACY_KOREAN_TICKERS_REDIS_KEY).toBe('korean:tickers');
    });
});
