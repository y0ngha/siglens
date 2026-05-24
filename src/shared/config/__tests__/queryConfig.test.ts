import {
    ASSET_INFO_STALE_TIME_MS,
    BARS_STALE_TIME_MS,
    KOREAN_TRANSLATION_STALE_TIME_MS,
    MARKET_SUMMARY_STALE_TIME_MS,
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
    TICKER_SEARCH_STALE_TIME_MS,
    USER_TIER_STALE_TIME_MS,
} from '@/shared/config/queryConfig';

describe('queryConfig staleTime constants', () => {
    const constants: Record<string, number> = {
        QUERY_STALE_TIME_MS,
        QUERY_GC_TIME_MS,
        MARKET_SUMMARY_STALE_TIME_MS,
        TICKER_SEARCH_STALE_TIME_MS,
        KOREAN_TRANSLATION_STALE_TIME_MS,
        ASSET_INFO_STALE_TIME_MS,
        BARS_STALE_TIME_MS,
        USER_TIER_STALE_TIME_MS,
    };

    it.each(Object.entries(constants))(
        '%s 는 양의 정수이다',
        (_name, value) => {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThan(0);
        }
    );

    it('FMP 티커 검색은 OHLCV 바보다 staleTime이 길다 (rate limit 보호)', () => {
        expect(TICKER_SEARCH_STALE_TIME_MS).toBeGreaterThan(BARS_STALE_TIME_MS);
    });

    it('user tier query key는 안정적이다', () => {
        expect(QUERY_KEYS.userTier()).toEqual(['user-tier']);
    });
});
