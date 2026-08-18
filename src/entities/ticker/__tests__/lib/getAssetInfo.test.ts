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
    tryGetTickerDatabaseClientMock,
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
    tryGetTickerDatabaseClientMock: vi.fn(),
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
vi.mock('../../lib/db', () => ({
    tryGetTickerDatabaseClient: () => tryGetTickerDatabaseClientMock(),
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
        tryGetTickerDatabaseClientMock.mockReset();
        tryGetTickerDatabaseClientMock.mockReturnValue(fakeDbClient);
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

    it('cache hit 시 cached 결과 반환', async () => {
        const cached: AssetInfo = { symbol: 'AAPL', name: 'Apple' };
        mockCache.get.mockResolvedValue(cached);
        await expect(getAssetInfo('aapl')).resolves.toBe(cached);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
        expect(mockRepository.findBySymbol).not.toHaveBeenCalled();
    });

    it('cache miss → DB hit 시 DB 결과 반환 후 cache 갱신', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        expect(searchBySymbolMock).not.toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
            expect.any(Number)
        );
    });

    it('cache miss → DB hit + cache write 실패해도 결과는 반환', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);
        mockCache.set.mockRejectedValue(new Error('cache write down'));

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        await Promise.resolve();
    });

    it('cache miss → DB read 실패 시 FMP 폴백', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockRejectedValue(new Error('db down'));
        searchBySymbolMock.mockResolvedValue([apple]);
        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
    });

    it('cache miss → DB miss → FMP → 한국명 미보유 시 결과 + 짧은 TTL cache + 번역 fire-and-forget', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({});
        translateCompanyNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.' },
            expect.any(Number)
        );
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);
    });

    it('한국명 보유 시 koreanName 결과 + DB upsert + cache 갱신', async () => {
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
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
            expect.any(Number)
        );
    });

    it('FMP 매치가 없으면 null 반환', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([]);
        await expect(getAssetInfo('AAPL')).resolves.toBeNull();
    });

    it('cache provider 가 null 이어도 DB 폴백 동작', async () => {
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
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        await expect(getAssetInfo('AAPL')).resolves.toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc.',
        });
    });

    it('cache get 실패 시 DB 폴백 시도', async () => {
        mockCache.get.mockRejectedValue(new Error('cache down'));
        mockRepository.findBySymbol.mockResolvedValue(dbRecord);
        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        expect(searchBySymbolMock).not.toHaveBeenCalled();
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

    it('한국명 보유 + DB upsert 실패해도 cache 는 갱신된다', async () => {
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });
        mockRepository.upsert.mockRejectedValue(new Error('db down'));

        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        await new Promise(resolve => setImmediate(resolve));
        expect(mockCache.set).toHaveBeenCalledWith(
            'asset-info:AAPL',
            { symbol: 'AAPL', name: 'Apple Inc.', koreanName: '애플' },
            expect.any(Number)
        );
    });

    it('DB 클라이언트 없을 때 한국명 보유 경로는 cache 만 갱신', async () => {
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        mockCache.get.mockResolvedValue(null);
        searchBySymbolMock.mockResolvedValue([apple]);
        getKoreanNamesMock.mockResolvedValue({ AAPL: '애플' });

        const result = await getAssetInfo('AAPL');
        expect(result?.koreanName).toBe('애플');
        await new Promise(resolve => setImmediate(resolve));
        expect(mockCache.set).toHaveBeenCalled();
    });

    it('한국명 보유 + DB 정상 + cache provider 없으면 cache 갱신 건너뜀', async () => {
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

    it('DB read 에서 AbortError (Neon cause.sourceError) 발생 시 FMP 폴백', async () => {
        // Neon wraps AbortError in cause.sourceError chain
        const sourceError = new Error('AbortError');
        sourceError.name = 'AbortError';
        const neonCause = Object.assign(new Error('Neon error'), {
            sourceError,
        });
        const outerError = Object.assign(new Error('DB read failed'), {
            cause: neonCause,
        });
        mockCache.get.mockResolvedValue(null);
        mockRepository.findBySymbol.mockRejectedValue(outerError);
        searchBySymbolMock.mockResolvedValue([apple]);
        const result = await getAssetInfo('AAPL');
        expect(result).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
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
        tryGetTickerDatabaseClientMock.mockReturnValue(null); // DB 미가용 → FMP fall-through
        searchBySymbolMock.mockRejectedValue(new Error('FMP HTTP 429'));

        await expect(getAssetInfo('AAPL')).rejects.toThrow('FMP HTTP 429');
    });

    it('KR 종목에 한글명이 없으면 yahoo quote 이름으로 응답하고 짧은 TTL로 캐시하며 번역을 fire-and-forget 한다', async () => {
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
            `asset-info:${symbol}`,
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

    it('getAssetInfo가 searchBySymbol을 throwOnInfraFailure로 호출한다', async () => {
        createCacheProviderMock.mockReturnValue(null);
        tryGetTickerDatabaseClientMock.mockReturnValue(null);
        searchBySymbolMock.mockResolvedValue([]); // 200 빈 결과 → null

        await getAssetInfo('NOPE');

        expect(searchBySymbolMock).toHaveBeenCalledWith('NOPE', {
            throwOnInfraFailure: true,
        });
    });
});
