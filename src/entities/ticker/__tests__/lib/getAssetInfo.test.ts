import { vi, type Mock } from 'vitest';
import type { CacheProvider } from '@y0ngha/siglens-core';
import type { AssetInfo } from '@/shared/lib/types';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
} from '@/shared/db/types';
import type { FmpSearchResult } from '../../model';

const mockCache: {
    get: Mock;
    set: Mock;
    delete: Mock;
} = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
};

const mockRepository: {
    findBySymbol: Mock;
    upsert: Mock;
} = {
    findBySymbol: vi.fn(),
    upsert: vi.fn(),
};

interface FakeDbClient {
    db: unknown;
}

const createCacheProviderMock = vi.fn<CacheProvider | null, []>();
const tryGetTickerDatabaseClientMock = vi.fn<FakeDbClient | null, []>();
const repositoryFactoryMock = vi.fn<AssetTranslationRepository, [unknown]>();
const searchBySymbolMock = vi.fn<Promise<FmpSearchResult[]>, [string]>();
const getKoreanNamesMock = vi.fn<
    Promise<Record<string, string>>,
    [string[]]
>();
const setKoreanTickersMock = vi.fn<Promise<void>, [unknown[]]>();
const translateCompanyNamesMock = vi.fn<
    Promise<Record<string, string>>,
    []
>();

vi.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
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
vi.mock('../../lib/fmpTickerApi', () => {
    const actual = jest.requireActual('../../lib/fmpTickerApi');
    return {
        ...actual,
        searchBySymbol: (q: string) => searchBySymbolMock(q),
    };
});
vi.mock('../../lib/koreanNameStore', () => ({
    getKoreanNames: (symbols: string[]) => getKoreanNamesMock(symbols),
    setKoreanTickers: (entries: unknown[]) => setKoreanTickersMock(entries),
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: () => translateCompanyNamesMock(),
}));

import {
    _resetInFlightTranslationsForTest,
    getAssetInfo,
} from '../../lib/getAssetInfo';

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
        setKoreanTickersMock.mockResolvedValue();
        translateCompanyNamesMock.mockReset();
        translateCompanyNamesMock.mockResolvedValue({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('잘못된 ticker format 은 null 반환', async () => {
        await expect(getAssetInfo('toolong')).resolves.toBeNull();
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
});
