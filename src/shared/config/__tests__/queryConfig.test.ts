import type { ModelId } from '@y0ngha/siglens-core';
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

describe('QUERY_KEYS.financialsAnalysis', () => {
    const MODEL_ID = 'gemini-2.5-flash' as ModelId;

    it('key 배열은 [prefix, UPPER_SYMBOL, modelId] 형태이다', () => {
        expect(QUERY_KEYS.financialsAnalysis('aapl', MODEL_ID)).toEqual([
            'financials-analysis',
            'AAPL',
            MODEL_ID,
        ]);
    });

    it('symbol을 대문자로 정규화한다', () => {
        const lower = QUERY_KEYS.financialsAnalysis('tsla', MODEL_ID);
        const upper = QUERY_KEYS.financialsAnalysis('TSLA', MODEL_ID);
        expect(lower).toEqual(upper);
        expect(lower[1]).toBe('TSLA');
    });

    it('fundamentalAnalysis와 prefix가 다르다 (캐시 충돌 없음)', () => {
        const financials = QUERY_KEYS.financialsAnalysis('AAPL', MODEL_ID);
        const fundamental = QUERY_KEYS.fundamentalAnalysis('AAPL', MODEL_ID);
        expect(financials[0]).not.toBe(fundamental[0]);
    });
});
