vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn((p: Promise<unknown>) => p.catch(() => {})),
}));

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCreateCacheProvider = vi.fn();

vi.mock('@y0ngha/siglens-core', () => ({
    createCacheProvider: (...args: unknown[]) =>
        mockCreateCacheProvider(...args),
}));

vi.mock('@/entities/ticker/lib/ticker', () => ({
    isValidTickerFormat: vi.fn().mockReturnValue(true),
}));

vi.mock('@/entities/ticker/api', () => ({
    DrizzleAssetTranslationRepository: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/db', () => ({
    tryGetTickerDatabaseClient: vi.fn().mockReturnValue(null),
}));

const mockSearchBySymbol = vi.fn().mockResolvedValue([]);
const mockFilterUsExchanges = vi.fn().mockReturnValue([]);

vi.mock('@/entities/ticker/lib/fmpTickerApi', () => ({
    searchBySymbol: (...args: unknown[]) => mockSearchBySymbol(...args),
    filterUsExchanges: (...args: unknown[]) => mockFilterUsExchanges(...args),
}));

vi.mock('@/entities/ticker/lib/koreanNameStore', () => ({
    getKoreanNames: vi.fn().mockResolvedValue({}),
    setKoreanTickers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/entities/ticker/lib/koreanTranslator', () => ({
    translateCompanyNames: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/entities/ticker/lib/cacheKeys', () => ({
    buildAssetInfoCacheKey: vi.fn((s: string) => `asset:${s}`),
    ASSET_INFO_CACHE_TTL_WITH_KOREAN: 86400,
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN: 43200,
}));

import {
    getAssetInfo,
    _resetInFlightTranslationsForTest,
} from '@/entities/ticker/lib/getAssetInfo';

describe('getAssetInfo degradation chain', () => {
    beforeEach(() => {
        _resetInFlightTranslationsForTest();
        mockCreateCacheProvider.mockReturnValue(null);
        mockSearchBySymbol.mockResolvedValue([]);
        mockFilterUsExchanges.mockReturnValue([]);
        mockCacheGet.mockResolvedValue(null);
        mockCacheSet.mockResolvedValue(undefined);
    });

    it('returns null when cache, DB, and FMP all return nothing', async () => {
        const result = await getAssetInfo('AAPL');

        expect(result).toBeNull();
    });

    it('returns null for invalid ticker format', async () => {
        const { isValidTickerFormat } =
            await import('@/entities/ticker/lib/ticker');
        (isValidTickerFormat as ReturnType<typeof vi.fn>).mockReturnValue(
            false
        );

        const result = await getAssetInfo('!!!');

        expect(result).toBeNull();

        (isValidTickerFormat as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    it('falls through to FMP when cache read throws', async () => {
        mockCreateCacheProvider.mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error('Redis down')),
            set: vi.fn().mockResolvedValue(undefined),
        });
        const fmpResults = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select Market',
            },
        ];
        mockSearchBySymbol.mockResolvedValue(fmpResults);
        mockFilterUsExchanges.mockReturnValue(fmpResults);

        const result = await getAssetInfo('AAPL');

        expect(result).not.toBeNull();
        expect(result?.symbol).toBe('AAPL');
    });

    it('logs warning when cache write fails (best-effort)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockCreateCacheProvider.mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockRejectedValue(new Error('Redis write failed')),
        });
        const fmpResults = [
            {
                symbol: 'TSLA',
                name: 'Tesla Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ',
            },
        ];
        mockSearchBySymbol.mockResolvedValue(fmpResults);
        mockFilterUsExchanges.mockReturnValue(fmpResults);

        const result = await getAssetInfo('TSLA');

        expect(result).not.toBeNull();
        await vi.waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith(
                '[getAssetInfo] cache write failed',
                expect.any(Error)
            );
        });
    });

    it('returns cached data when available', async () => {
        const cachedInfo = {
            symbol: 'MSFT',
            name: 'Microsoft Corporation',
            koreanName: '마이크로소프트',
        };
        mockCreateCacheProvider.mockReturnValue({
            get: vi.fn().mockResolvedValue(cachedInfo),
            set: vi.fn(),
        });

        mockSearchBySymbol.mockClear();
        const result = await getAssetInfo('MSFT');

        expect(result).toEqual(cachedInfo);
        expect(mockSearchBySymbol).not.toHaveBeenCalled();
    });
});
