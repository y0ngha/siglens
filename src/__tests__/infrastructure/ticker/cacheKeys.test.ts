import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_YEAR,
} from '@/domain/constants/time';
import {
    ASSET_INFO_CACHE_TTL_WITH_KOREAN,
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    ASSET_INFO_HOURS_WITHOUT_KOREAN,
    buildAssetInfoCacheKey,
    buildTickerSearchCacheKey,
    TICKER_SEARCH_CACHE_TTL,
} from '@/infrastructure/ticker/cacheKeys';

describe('ticker cache constants', () => {
    it('TICKER_SEARCH_CACHE_TTL', () => {
        expect(TICKER_SEARCH_CACHE_TTL).toBe(SECONDS_PER_DAY);
    });

    it('ASSET_INFO_CACHE_TTL_WITH_KOREAN', () => {
        expect(ASSET_INFO_CACHE_TTL_WITH_KOREAN).toBe(SECONDS_PER_YEAR);
    });

    it('ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN', () => {
        expect(ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN).toBe(
            ASSET_INFO_HOURS_WITHOUT_KOREAN * SECONDS_PER_HOUR
        );
    });
});

describe('ticker cache key builders', () => {
    it('buildTickerSearchCacheKey lowercases the query', () => {
        expect(buildTickerSearchCacheKey('AAPL')).toBe('ticker:search:aapl');
        expect(buildTickerSearchCacheKey('애플')).toBe('ticker:search:애플');
    });

    it('buildAssetInfoCacheKey uppercases the symbol', () => {
        expect(buildAssetInfoCacheKey('aapl')).toBe('asset-info:AAPL');
        expect(buildAssetInfoCacheKey('AAPL')).toBe('asset-info:AAPL');
    });
});
