import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import {
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    ASSET_INFO_HOURS_WITHOUT_KOREAN,
    buildAssetInfoProvisionalCacheKey,
    buildTickerSearchCacheKey,
    TICKER_SEARCH_CACHE_TTL,
} from '../../lib/cacheKeys';

describe('ticker cache constants', () => {
    it('TICKER_SEARCH_CACHE_TTL', () => {
        expect(TICKER_SEARCH_CACHE_TTL).toBe(SECONDS_PER_DAY);
    });

    it('ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN', () => {
        expect(ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN).toBe(
            ASSET_INFO_HOURS_WITHOUT_KOREAN * SECONDS_PER_HOUR
        );
    });
});

describe('ticker cache key builders', () => {
    it('buildTickerSearchCacheKey lowercases the query', () => {
        expect(buildTickerSearchCacheKey('AAPL')).toBe('ticker:search:v3:aapl');
        expect(buildTickerSearchCacheKey('애플')).toBe('ticker:search:v3:애플');
    });

    it('buildAssetInfoProvisionalCacheKey uppercases the symbol and never collides with the legacy asset-info:<SYM> key', () => {
        expect(buildAssetInfoProvisionalCacheKey('aapl')).toBe(
            'asset-info:provisional:AAPL'
        );
        expect(buildAssetInfoProvisionalCacheKey('AAPL')).toBe(
            'asset-info:provisional:AAPL'
        );
        expect(buildAssetInfoProvisionalCacheKey('AAPL')).not.toBe(
            'asset-info:AAPL'
        );
    });
});
