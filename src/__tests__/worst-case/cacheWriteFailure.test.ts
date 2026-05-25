vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn((p: Promise<unknown>) => p.catch(() => {})),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    createCacheProvider: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/ticker', () => ({
    isValidTickerFormat: vi.fn().mockReturnValue(true),
    deduplicateResults: vi.fn((arr: unknown[]) => arr),
    isKoreanInput: vi.fn().mockReturnValue(false),
}));

vi.mock('@/entities/ticker/api', () => ({
    DrizzleAssetTranslationRepository: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/db', () => ({
    tryGetTickerDatabaseClient: vi.fn().mockReturnValue(null),
}));

vi.mock('@/entities/ticker/lib/fmpTickerApi', () => ({
    searchBySymbol: vi.fn().mockResolvedValue([]),
    searchByName: vi.fn().mockResolvedValue([]),
    filterUsExchanges: vi.fn().mockReturnValue([]),
    toTickerSearchResult: vi.fn((r: unknown) => r),
}));

vi.mock('@/entities/ticker/lib/koreanNameStore', () => ({
    getKoreanNames: vi.fn().mockResolvedValue({}),
    setKoreanTickers: vi.fn().mockResolvedValue(undefined),
    searchByKoreanName: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/entities/ticker/lib/koreanTranslator', () => ({
    translateCompanyNames: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/entities/ticker/lib/cacheKeys', () => ({
    buildTickerSearchCacheKey: vi.fn((q: string) => `search:${q}`),
    TICKER_SEARCH_CACHE_TTL: 300,
    buildAssetInfoCacheKey: vi.fn((s: string) => `asset:${s}`),
    ASSET_INFO_CACHE_TTL_WITH_KOREAN: 86400,
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN: 43200,
}));

vi.mock('@/entities/ticker/lib/backgroundTask', () => ({
    fireAndForget: vi.fn((p: Promise<unknown>) => p.catch(() => {})),
}));

import {
    searchTicker,
    _resetInFlightTranslationsForTest,
} from '@/entities/ticker/lib/searchTicker';
import { createCacheProvider } from '@y0ngha/siglens-core';

const mockCreateCacheProvider = createCacheProvider as ReturnType<typeof vi.fn>;

describe('Cache write failure degrades gracefully', () => {
    beforeEach(() => {
        _resetInFlightTranslationsForTest();
        vi.clearAllMocks();
    });

    it('logs warning when cache set fails but still returns results', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mockCache = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
        };
        mockCreateCacheProvider.mockReturnValue(mockCache);

        const result = await searchTicker('AAPL');

        expect(result).toEqual([]);
        await vi.waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith(
                '[searchTicker] cache write failed',
                expect.any(Error)
            );
        });
    });

    it('returns results when cache is null (provider unavailable)', async () => {
        mockCreateCacheProvider.mockReturnValue(null);

        const result = await searchTicker('AAPL');

        expect(result).toEqual([]);
    });

    it('returns cached results when cache read succeeds', async () => {
        const cached = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ',
            },
        ];
        const mockCache = {
            get: vi.fn().mockResolvedValue(cached),
            set: vi.fn(),
        };
        mockCreateCacheProvider.mockReturnValue(mockCache);

        const result = await searchTicker('AAPL');

        expect(result).toEqual(cached);
    });
});
