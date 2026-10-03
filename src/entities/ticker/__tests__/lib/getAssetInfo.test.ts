import type { CacheProvider } from '@y0ngha/siglens-core';
import type { AssetInfo } from '@/shared/lib/types';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
} from '@/shared/db/types';
import type { FmpSearchResult } from '../../model';

const {
    mockCache,
    mockRepository,
    createCacheProviderMock,
    tryGetDatabaseClientMock,
    repositoryFactoryMock,
    searchBySymbolMock,
    getKoreanNamesMock,
    setKoreanTickersMock,
    translateCompanyNamesMock,
    fetchKrEquityQuoteNameMock,
} = vi.hoisted(() => ({
    mockCache: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
    mockRepository: {
        findBySymbol: vi.fn(),
        upsert: vi.fn(),
    },
    createCacheProviderMock: vi.fn(),
    tryGetDatabaseClientMock: vi.fn(),
    repositoryFactoryMock: vi.fn(),
    searchBySymbolMock: vi.fn(),
    getKoreanNamesMock: vi.fn(),
    setKoreanTickersMock: vi.fn(),
    translateCompanyNamesMock: vi.fn(),
    fetchKrEquityQuoteNameMock: vi.fn(),
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
    DrizzleAssetTranslationRepository: class {
        constructor(db: unknown) {
            return repositoryFactoryMock(db) as unknown as object;
        }
    },
}));
vi.mock('../../lib/fmpTickerApi', async () => {
    const actual = await vi.importActual('../../lib/fmpTickerApi');
    return {
        ...actual,
        searchBySymbol: (
            q: string,
            options?: { throwOnInfraFailure?: boolean }
        ) => searchBySymbolMock(q, options),
    };
});
vi.mock('../../lib/koreanNameStore', () => ({
    getKoreanNames: (symbols: string[]) => getKoreanNamesMock(symbols),
    setKoreanTickers: (entries: unknown[]) => setKoreanTickersMock(entries),
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: () => translateCompanyNamesMock(),
}));
// yahoo quote 조회는 동적 import + server-only 의존이라 유닛에서는 이름 해석만
// 대역한다 — resolveKrEquityAssetInfo 갈래는 이 결과만 있으면 재현된다.
vi.mock('../../lib/krEquityQuoteName', () => ({
    fetchKrEquityQuoteName: (symbol: string) =>
        fetchKrEquityQuoteNameMock(symbol),
}));
// Crypto branch: equity test cases return null (not a crypto symbol), so the
// existing equity path is unaffected. The crypto branch itself is covered by
// getAssetInfo.crypto.test.ts.
vi.mock('../../lib/cryptoAssetStore', () => ({
    getCryptoAsset: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../lib/fmpCryptoMembership', () => ({
    fmpCryptoMembership: vi.fn().mockResolvedValue(null),
}));

import {
    _resetInFlightTranslationsForTest,
    getAssetInfo,
} from '../../lib/getAssetInfo';
import { ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN } from '../../lib/cacheKeys';
import { getCryptoAsset } from '../../lib/cryptoAssetStore';
import { fmpCryptoMembership } from '../../lib/fmpCryptoMembership';

const apple: FmpSearchResult = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

const fakeDbClient: FakeDbClient = { db: {} };

const dbRecord: AssetTranslationRecord = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    koreanName: '애플',
    fmpSymbol: 'AAPL',
};

describe('getAssetInfo', () => {
    beforeEach(() => {
        _resetInFlightTranslationsForTest();
        mockCache.get.mockReset();
        mockCache.set.mockReset();
        mockCache.set.mockResolvedValue(undefined);
        mockCache.delete.mockReset();
        mockRepository.findBySymbol.mockReset();
        mockRepository.findBySymbol.mockResolvedValue(null);
        mockRepository.upsert.mockReset();
        mockRepository.upsert.mockResolvedValue(undefined);
        createCacheProviderMock.mockReset();
        createCacheProviderMock.mockReturnValue(
            mockCache as unknown as CacheProvider
        );
        tryGetDatabaseClientMock.mockReset();
        tryGetDatabaseClientMock.mockReturnValue(fakeDbClient);
        repositoryFactoryMock.mockReset();
        repositoryFactoryMock.mockReturnValue(
            mockRepository as unknown as AssetTranslationRepository
        );
        searchBySymbolMock.mockReset();
        getKoreanNamesMock.mockReset();
        getKoreanNamesMock.mockResolvedValue({});
        setKoreanTickersMock.mockReset();
        setKoreanTickersMock.mockResolvedValue(undefined);
        translateCompanyNamesMock.mockReset();
        translateCompanyNamesMock.mockResolvedValue({});
        fetchKrEquityQuoteNameMock.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('잘못된 ticker format 은 null 반환', async () => {
        // isAdmissibleSymbolShape는 17자 초과, 공백, 특수문자를 거부한다.
        // 구 isValidTickerFormat(6+ 글자 거부)과 달리 SYMBOL_EDGE_RE(16자까지 허용)이
        // 기준이므로 과거 'toolong' 대신 공백 포함 입력으로 테스트한다.
        await expect(getAssetInfo('invalid symbol')).resolves.toBeNull();
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    // 해석 순서는 DB → Redis 임시 항목(12h) → FMP다. Redis는 DB 중복 사본이라
    // (명령 수 과금) 맨 앞에서 읽지 않는다.
    it('DB hit 시 Redis를 읽지도 쓰지도 않고 FMP도 부르지 않는다', async () => {
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('aapl');

        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('DB hit이 이미 존재하는 임시 Redis 항목보다 우선한다', async () => {
        // 번역이 DB에 들어가면 12시간 임시 영문 항목이 남아 있어도 한글명이 나가야 한다.
        mockCache.get.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
        } satisfies AssetInfo);
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('AAPL');

        expect(result?.koreanName).toBe('애플');
        expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('DB miss 뒤에야 임시 Redis 항목을 조회하고, 히트하면 FMP를 부르지 않는다', async () => {
        const provisional: AssetInfo = { symbol: 'AAPL', name: 'Apple' };
        mockCache.get.mockResolvedValue(provisional);

        await expect(getAssetInfo('aapl')).resolves.toBe(provisional);

        expect(mockRepository.findBySymbol).toHaveBeenCalledWith('AAPL');
        expect(mockCache.get).toHaveBeenCalledWith(
            'asset-info:provisional:AAPL'
        );
        expect(
            mockRepository.findBySymbol.mock.invocationCallOrder[0]
        ).toBeLessThan(mockCache.get.mock.invocationCallOrder[0]);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
        expect(getKoreanNamesMock).not.toHaveBeenCalled();
        expect(translateCompanyNamesMock).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('DB 클라이언트가 없으면 임시 Redis 항목으로 응답한다', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        const provisional: AssetInfo = { symbol: 'AAPL', name: 'Apple' };
        mockCache.get.mockResolvedValue(provisional);

        await expect(getAssetInfo('AAPL')).resolves.toBe(provisional);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    /**
     * 정본 한글명(`CANONICAL_KOREAN_NAMES`)은 **모든 반환 경로**를 덮어야 한다.
     *
     * 과거에는 Redis 캐시가 먼저 답해서 DB 경로에만 덮은 정본이 무시됐다(로컬
     * 실증에서 제목이 하나도 안 바뀜). 지금은 DB·임시 Redis 항목 두 경로를 각각 고정한다.
     */
    it('DB hit이어도 정본 한글명이 저장된 값을 덮는다', async () => {
        // LAES의 DB 값은 '씰스큐'였다 — 정본은 '실스큐'(외래어 표기법).
        mockRepository.findBySymbol.mockResolvedValue({
            symbol: 'LAES',
            name: 'SEALSQ Corp',
            koreanName: '씰스큐',
            fmpSymbol: 'LAES',
        } satisfies AssetTranslationRecord);

        await expect(getAssetInfo('laes')).resolves.toEqual({
            symbol: 'LAES',
            name: 'SEALSQ Corp',
            koreanName: '실스큐',
        });
    });

    it('임시 Redis 항목 hit이어도 정본 한글명이 덮는다', async () => {
        mockCache.get.mockResolvedValue({
            symbol: 'LAES',
            name: 'SEALSQ Corp',
            koreanName: '씰스큐',
        } satisfies AssetInfo);

        await expect(getAssetInfo('laes')).resolves.toEqual({
            symbol: 'LAES',
            name: 'SEALSQ Corp',
            koreanName: '실스큐',
        });
    });

    it('정본 목록에 없는 심볼은 저장된 한글명을 그대로 쓴다', async () => {
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('aapl');

        expect(result?.koreanName).toBe('애플');
    });

    it('crypto_assets DB hit은 Redis를 읽지도 쓰지도 않는다', async () => {
        vi.mocked(getCryptoAsset).mockResolvedValueOnce({
            symbol: 'BTC',
            name: 'Bitcoin',
            koreanName: '비트코인',
            circulatingSupply: 19_000_000,
        });

        const result = await getAssetInfo('BTC');

        expect(result).toEqual({
            symbol: 'BTC',
            name: 'Bitcoin',
            marketProfile: 'crypto',
            koreanName: '비트코인',
        });
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
        expect(mockRepository.findBySymbol).not.toHaveBeenCalled();
    });

    it('FMP 크립토 목록 hit은 Redis를 읽지도 쓰지도 않는다', async () => {
        vi.mocked(fmpCryptoMembership).mockResolvedValueOnce({
            name: 'New Coin',
        });

        const result = await getAssetInfo('NEWCOIN');

        expect(result).toEqual({
            symbol: 'NEWCOIN',
            name: 'New Coin',
            marketProfile: 'crypto',
        });
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('크립토 판정이 asset_translations보다 먼저다', async () => {
        vi.mocked(getCryptoAsset).mockResolvedValueOnce({
            symbol: 'AAPL',
            name: 'Crypto AAPL',
            koreanName: null,
            circulatingSupply: null,
        });
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('AAPL');

        expect(result?.marketProfile).toBe('crypto');
        expect(mockRepository.findBySymbol).not.toHaveBeenCalled();
    });

    it('DB hit이어도 Redis 쓰기가 필요 없으므로 쓰기 실패와 무관하게 결과를 반환한다', async () => {
        mockCache.set.mockRejectedValue(new Error('cache write down'));
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('DB read 실패 시 FMP 폴백', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockRejectedValue(new Error('db down'));
        searchBySymbolMock.mockResolvedValue([apple]);
        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
    });

    it('DB miss → 임시 항목 miss → FMP → 한국명 미보유 시 결과 + 12시간 임시 cache + 번역 fire-and-forget', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
        expect(mockCache.set).toHaveBeenCalledTimes(1);
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:provisional:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.' },
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);
    });

    it('한국명 보유 시 koreanName 결과 + DB upsert만 하고 Redis는 쓰지 않는다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        await new Promise(resolve => setImmediate(resolve));
        expect(mockRepository.upsert).toHaveBeenCalledWith({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        });
        expect(setKoreanTickersMock).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('번역 완료 후 persistTranslation은 DB upsert만 하고 Redis에 쓰지 않는다', async () => {
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ AAPL: '애플' });

        await getAssetInfo('AAPL');
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));

        expect(mockRepository.upsert).toHaveBeenCalledWith({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        });
        // 쓰기는 미번역 응답 직후의 12시간 임시 항목 하나뿐이다.
        const setCalls = mockCache.set.mock.calls;
        expect(setCalls).toHaveLength(1);
        expect(setCalls[0][2]).toBe(ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN);
    });

    it('FMP 매치가 없으면 null 반환', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([]);
        await expect(getAssetInfo('AAPL')).resolves.toBeNull();
    });

    it('cache provider 가 null 이어도 DB 조회 동작', async () => {
        createCacheProviderMock.mockReturnValue(null);
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);
        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('cache 와 DB 클라이언트 모두 없으면 FMP 만 호출', async () => {
        createCacheProviderMock.mockReturnValue(null);
        tryGetDatabaseClientMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        await expect(getAssetInfo('AAPL')).resolves.toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
        });
    });

    it('DB hit이면 Redis가 죽어 있어도 영향이 없다', async () => {
        mockCache.get.mockRejectedValue(new Error('cache down'));
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);
        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('DB miss + 임시 항목 조회 실패 시 FMP로 폴백한다', async () => {
        mockCache.get.mockRejectedValue(new Error('cache down'));
        searchBySymbolMock.mockResolvedValue([apple]);

        const result = await getAssetInfo('AAPL');

        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
        expect(searchBySymbolMock).toHaveBeenCalledTimes(1);
    });

    it('번역 결과에 symbol 이 없으면 setKoreanTickers / DB upsert 호출하지 않는다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({});

        await getAssetInfo('AAPL');
        await new Promise(resolve => setImmediate(resolve));
        expect(setKoreanTickersMock).not.toHaveBeenCalled();
        expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('한국명 보유 + DB upsert 실패는 warn으로 삼켜지고 한글명 임시 항목이 Redis에 남는다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });
        mockRepository.upsert.mockRejectedValue(new Error('db down'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[getAssetInfo] DB upsert failed',
            expect.any(Error)
        );
        // DB에 못 썼으므로 한글명을 담은 12시간 임시 항목이 대신 남는다.
        expect(mockCache.set).toHaveBeenCalledTimes(1);
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:provisional:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
        warnSpy.mockRestore();
    });

    it('DB 클라이언트 없을 때 한국명 보유 경로는 한글명 임시 항목만 Redis에 쓴다', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        await new Promise(resolve => setImmediate(resolve));
        expect(mockCache.set).toHaveBeenCalledTimes(1);
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:provisional:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
        expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('DB 저하 중 쓴 한글명 임시 항목은 다음 호출에서 FMP 없이 한글명으로 응답한다', async () => {
        tryGetDatabaseClientMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        await getAssetInfo('AAPL');
        await new Promise(resolve => setImmediate(resolve));
        const written = mockCache.set.mock.calls.find(
            ([key]) => key === 'asset-info:provisional:AAPL'
        );
        expect(written).toBeDefined();

        searchBySymbolMock.mockClear();
        mockCache.get.mockImplementation(async (key: string) =>
            key === 'asset-info:provisional:AAPL' ? written?.[1] : null
        );

        const second = await getAssetInfo('AAPL');

        expect(second?.koreanName).toBe('애플');
        expect(searchBySymbolMock).not.toHaveBeenCalled();
    });

    it('번역 완료 후 DB upsert가 실패하면 번역된 한글명 임시 항목이 최초 응답과 같은 형태로 남는다', async () => {
        searchBySymbolMock.mockResolvedValue([{ ...apple, symbol: 'AAPL.MX' }]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ AAPL: '애플' });
        mockRepository.upsert.mockRejectedValue(new Error('db down'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await getAssetInfo('AAPL');
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));

        // 미번역 응답 직후 쓴 영문 임시 항목에 이어 한글명 항목이 덮어쓴다.
        const koreanWrite = mockCache.set.mock.calls.find(
            ([key, value]) =>
                key === 'asset-info:provisional:AAPL' &&
                (value as AssetInfo).koreanName === '애플'
        );
        expect(koreanWrite?.[1]).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL.MX',
        });
        warnSpy.mockRestore();
    });

    it('KR 종목 번역 완료 후 DB upsert가 실패하면 marketProfile을 포함한 한글명 임시 항목이 남는다', async () => {
        // translateAndPersist의 marketProfile 전달이 끊기면 이 항목이 kr-equity 표지를
        // 잃는다 — 그 한 줄을 지키는 유일한 테스트다.
        const symbol = '999999.KQ'; // CURATED_KOREAN_NAMES에 없는 형상만 맞는 KR 심볼
        const provisionalKey = `asset-info:provisional:${symbol}`;
        fetchKrEquityQuoteNameMock.mockResolvedValue('Fake Korea Inc.');
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ [symbol]: '가짜코리아' });
        mockRepository.upsert.mockRejectedValue(new Error('db down'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await getAssetInfo(symbol);
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));

        // 미번역 응답 직후 쓴 영문 임시 항목에 이어 한글명 항목이 덮어쓴다.
        const koreanWrite = mockCache.set.mock.calls.find(
            ([key, value]) =>
                key === provisionalKey &&
                (value as AssetInfo).koreanName === '가짜코리아'
        );
        expect(koreanWrite?.[1]).toEqual({
            symbol,
            name: 'Fake Korea Inc.',
            koreanName: '가짜코리아',
            marketProfile: 'kr-equity',
        });
        expect(koreanWrite?.[2]).toBe(ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN);
        warnSpy.mockRestore();
    });

    it('한국명 보유 + DB 정상 + cache provider 없어도 DB upsert는 수행된다', async () => {
        createCacheProviderMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        await new Promise(resolve => setImmediate(resolve));
        expect(mockRepository.upsert).toHaveBeenCalledTimes(1);
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('FMP 결과 중 정확히 일치하지 않으면 첫 번째 결과와 FMP symbol 을 사용', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([{ ...apple, symbol: 'AAPL.MX' }]);
        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            fmpSymbol: 'AAPL.MX',
        });
    });

    it('동일 symbol 에 대한 동시 호출은 single-flight 로 묶여 Gemini 번역기를 정확히 1회만 호출한다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});

        // Hold the translator promise open until all concurrent callers have
        // attached to the same in-flight Promise.
        let resolveTranslate: (v: Record<string, string>) => void = () => {};
        translateCompanyNamesMock.mockReturnValue(
            new Promise<Record<string, string>>(resolve => {
                resolveTranslate = resolve;
            })
        );

        const concurrent = await Promise.all(
            Array.from({ length: 5 }, () => getAssetInfo('AAPL'))
        );

        expect(concurrent.every(r => r?.symbol === 'AAPL')).toBe(true);

        // All 5 fire-and-forget translations should share a single Gemini call.
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);

        resolveTranslate({ AAPL: '애플' });
        await new Promise(resolve => setImmediate(resolve));
    });

    it('번역 저장 시 canonical symbol 과 FMP symbol 을 함께 보존한다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([{ ...apple, symbol: 'AAPL.MX' }]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL.MX',
        });
        await new Promise(resolve => setImmediate(resolve));
        expect(mockRepository.upsert).toHaveBeenCalledWith({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL.MX',
        });
    });

    it('DB read 에서 직접 AbortError 발생 시 FMP 폴백', async () => {
        const abortError = new Error('AbortError');
        abortError.name = 'AbortError';
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockRejectedValue(abortError);
        searchBySymbolMock.mockResolvedValue([apple]);
        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
    });

    it('FMP 검색 시간 초과(reject)는 에러를 전파한다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockRejectedValue(new Error('FMP timeout'));
        await expect(getAssetInfo('AAPL')).rejects.toThrow('FMP timeout');
    });

    it('FMP 인프라 에러를 throw로 전파한다 (null로 degrade하지 않음)', async () => {
        createCacheProviderMock.mockReturnValue(null); // 캐시 미스
        tryGetDatabaseClientMock.mockReturnValue(null); // DB 미가용 → FMP fall-through
        searchBySymbolMock.mockRejectedValue(new Error('FMP HTTP 429'));

        await expect(getAssetInfo('AAPL')).rejects.toThrow('FMP HTTP 429');
    });

    it('KR 종목에 한글명이 없으면 yahoo quote 이름으로 응답하고 12시간 임시 항목으로 캐시하며 번역을 fire-and-forget 한다', async () => {
        // E2E 시임은 CURATED_KOREAN_NAMES로 바로 단락시켜 이 분기를 밟지 않는다 —
        // 유닛에서 확인 안 하면 전 국내 종목의 ~99%(2026-08 실측 2,570/2,595)가 타는
        // 경로가 아무 테스트에도 안 걸린다. 이 갈래가 곧 korean_tickers를 채우는
        // translateAndPersist 발동 지점이라, 검색 색인 전체가 이 경로에 달려 있다.
        const symbol = '999999.KQ'; // CURATED_KOREAN_NAMES에 없는 형상만 맞는 KR 심볼
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null); // DB에 아직 번역이 없다
        fetchKrEquityQuoteNameMock.mockResolvedValue('Fake Korea Inc.');
        getKoreanNamesMock.mockResolvedValue({}); // koreanNameStore도 아직 비어 있다
        translateCompanyNamesMock.mockResolvedValue({ [symbol]: '가짜코리아' });

        const result = await getAssetInfo(symbol);

        expect(result).toEqual({
            symbol,
            name: 'Fake Korea Inc.',
            marketProfile: 'kr-equity',
        });
        expect(mockCache.set).toHaveBeenCalledWith(
            `asset-info:provisional:${symbol}`,
            result,
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );

        await new Promise(resolve => setImmediate(resolve));
        // translateAndPersist가 실제로 발동했는지 확인한다 — 여기가 korean_tickers를
        // 채우는 유일한 경로다. 발동하지 않으면 해당 종목은 영원히 한글 검색에 안 잡힌다.
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);
        expect(setKoreanTickersMock).toHaveBeenCalledWith([
            {
                symbol,
                name: 'Fake Korea Inc.',
                koreanName: '가짜코리아',
                exchange: 'KOSDAQ',
                exchangeFullName: 'KOSDAQ',
            },
        ]);
    });

    it('KR 종목의 임시 Redis 항목은 DB miss 뒤에 읽히고, hit이면 yahoo를 부르지 않는다', async () => {
        const symbol = '999999.KQ';
        const provisional: AssetInfo = {
            symbol,
            name: 'Fake Korea Inc.',
            marketProfile: 'kr-equity',
        };
        mockCache.get.mockResolvedValue(provisional);

        await expect(getAssetInfo(symbol)).resolves.toBe(provisional);

        expect(mockRepository.findBySymbol).toHaveBeenCalledWith(symbol);
        expect(fetchKrEquityQuoteNameMock).not.toHaveBeenCalled();
        expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('KR 대표 종목은 koreanNameStore가 비어도 큐레이션 카탈로그로 한글명을 채운다', async () => {
        // ISR은 첫 렌더를 캐시에 굳힌다. lazy 번역이 끝나기를 기다리면 대표 종목의
        // SEO 제목이 revalidate 주기 내내 `005930.KS 주가 전망`으로 남는다 —
        // 카탈로그 fallback이 그걸 막는 유일한 장치다.
        const symbol = '005930.KS';
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        fetchKrEquityQuoteNameMock.mockResolvedValue(
            'Samsung Electronics Co Ltd'
        );
        getKoreanNamesMock.mockResolvedValue({}); // 번역 스토어가 아직 비어 있다

        const result = await getAssetInfo(symbol);

        expect(result).toEqual({
            symbol,
            name: 'Samsung Electronics Co Ltd',
            marketProfile: 'kr-equity',
            koreanName: '삼성전자',
        });
        // 한글명을 이미 확보했으므로 Redis에는 굳히지 않고(DB upsert가 정본),
        // 번역 API도 부르지 않는다.
        expect(mockCache.set).not.toHaveBeenCalled();
        expect(translateCompanyNamesMock).not.toHaveBeenCalled();

        await new Promise(resolve => setImmediate(resolve));
        // 카탈로그 값도 DB에 내려써야 다음 요청이 카탈로그 없이도 맞는다.
        expect(mockRepository.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ symbol, koreanName: '삼성전자' })
        );
    });

    it('한국명 보유 + repository 생성 실패해도 결과는 반환되고 실패는 warn으로 삼켜진다', async () => {
        // repository 생성 자체가 던지면(예: DB 커넥션 풀 소진) persistTranslation의
        // await 밖(try 이전)에서 예외가 나므로, fireAndForget에 붙은 .catch가
        // 그 거절을 삼켜야 한다 — 안 그러면 unhandled rejection이 프로세스를 죽인다.
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });
        // 첫 호출은 readFromDatabase(DB miss 확인)용 — 정상 반환한다.
        // 두 번째 호출(persistTranslation)에서만 생성이 실패하게 한다.
        repositoryFactoryMock.mockReturnValueOnce(
            mockRepository as unknown as AssetTranslationRepository
        );
        repositoryFactoryMock.mockImplementation(() => {
            throw new Error('pool exhausted');
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');

        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[getAssetInfo] persist failed',
            expect.any(Error)
        );
        // DB 저하 중에도 한글명 임시 항목은 남아야 후속 호출이 FMP를 반복하지 않는다.
        const provisionalWrite = mockCache.set.mock.calls.find(
            ([key]) => key === 'asset-info:provisional:AAPL'
        );
        expect(provisionalWrite?.[1]).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        expect(provisionalWrite?.[2]).toBe(ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN);
        warnSpy.mockRestore();
    });

    it('한국명 미보유 + 번역 API 거절 시 백그라운드 번역 실패가 warn으로 삼켜진다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockRejectedValue(new Error('gemini down'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });

        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[getAssetInfo] background translation failed',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('KR 종목 + 한국명 보유 + repository 생성 실패해도 결과는 반환되고 실패는 warn으로 삼켜진다', async () => {
        const symbol = '005930.KS'; // CURATED_KOREAN_NAMES에 있어 koreanName이 즉시 채워진다
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        fetchKrEquityQuoteNameMock.mockResolvedValue(
            'Samsung Electronics Co Ltd'
        );
        getKoreanNamesMock.mockResolvedValue({});
        // 첫 호출은 readFromDatabase(DB miss 확인)용 — 정상 반환한다.
        // 두 번째 호출(persistTranslation)에서만 생성이 실패하게 한다.
        repositoryFactoryMock.mockReturnValueOnce(
            mockRepository as unknown as AssetTranslationRepository
        );
        repositoryFactoryMock.mockImplementation(() => {
            throw new Error('pool exhausted');
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await getAssetInfo(symbol);
        expect(result?.koreanName).toBe('삼성전자');

        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[getAssetInfo] kr persist failed',
            expect.any(Error)
        );
        const provisionalWrite = mockCache.set.mock.calls.find(
            ([key]) => key === `asset-info:provisional:${symbol}`
        );
        expect(provisionalWrite?.[1]).toEqual({
            symbol,
            name: 'Samsung Electronics Co Ltd',
            marketProfile: 'kr-equity',
            koreanName: '삼성전자',
        });
        expect(provisionalWrite?.[2]).toBe(ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN);
        warnSpy.mockRestore();
    });

    it('KR 종목 + 한국명 미보유 + 번역 API 거절 시 백그라운드 번역 실패가 warn으로 삼켜진다', async () => {
        const symbol = '999999.KQ'; // CURATED_KOREAN_NAMES에 없는 형상만 맞는 KR 심볼
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        fetchKrEquityQuoteNameMock.mockResolvedValue('Fake Korea Inc.');
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockRejectedValue(new Error('gemini down'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await getAssetInfo(symbol);
        expect(result).toEqual({
            symbol,
            name: 'Fake Korea Inc.',
            marketProfile: 'kr-equity',
        });

        await new Promise(resolve => setImmediate(resolve));
        expect(warnSpy).toHaveBeenCalledWith(
            '[getAssetInfo] kr background translation failed',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('getAssetInfo가 searchBySymbol을 throwOnInfraFailure로 호출한다', async () => {
        createCacheProviderMock.mockReturnValue(null);
        tryGetDatabaseClientMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([]); // 200 빈 결과 → null

        await getAssetInfo('NOPE');

        expect(searchBySymbolMock).toHaveBeenCalledWith('NOPE', {
            throwOnInfraFailure: true,
        });
    });
});
