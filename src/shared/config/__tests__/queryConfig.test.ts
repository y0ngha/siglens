import type {
    ModelId,
    Timeframe,
    DashboardTimeframe,
} from '@y0ngha/siglens-core';
import {
    ASSET_INFO_STALE_TIME_MS,
    BARS_STALE_TIME_MS,
    CURRENT_USER_STALE_TIME_MS,
    KOREAN_TRANSLATION_STALE_TIME_MS,
    MARKET_SUMMARY_STALE_TIME_MS,
    QUERY_GC_TIME_MS,
    QUERY_KEYS,
    QUERY_STALE_TIME_MS,
    REGISTERED_PROVIDERS_STALE_TIME_MS,
    SECTOR_SIGNALS_STALE_TIME_MS,
    TICKER_SEARCH_STALE_TIME_MS,
    USER_TIER_STALE_TIME_MS,
} from '@/shared/config/queryConfig';

describe('queryConfig staleTime constants', () => {
    const constants: Record<string, number> = {
        QUERY_STALE_TIME_MS,
        QUERY_GC_TIME_MS,
        MARKET_SUMMARY_STALE_TIME_MS,
        SECTOR_SIGNALS_STALE_TIME_MS,
        TICKER_SEARCH_STALE_TIME_MS,
        KOREAN_TRANSLATION_STALE_TIME_MS,
        ASSET_INFO_STALE_TIME_MS,
        BARS_STALE_TIME_MS,
        USER_TIER_STALE_TIME_MS,
        CURRENT_USER_STALE_TIME_MS,
        REGISTERED_PROVIDERS_STALE_TIME_MS,
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

    it('currentUser query key는 안정적이다', () => {
        expect(QUERY_KEYS.currentUser()).toEqual(['current-user']);
    });

    it('marketSummary query key는 안정적이다', () => {
        expect(QUERY_KEYS.marketSummary()).toEqual(['market-summary']);
    });

    it('marketBriefing query key는 안정적이다', () => {
        expect(QUERY_KEYS.marketBriefing()).toEqual(['market-briefing']);
    });

    it('macroBriefing query key는 안정적이다', () => {
        expect(QUERY_KEYS.macroBriefing()).toEqual(['macro-briefing']);
    });

    it('remainingTokens query key는 안정적이다', () => {
        expect(QUERY_KEYS.remainingTokens()).toEqual([
            'chat',
            'remaining-tokens',
        ]);
    });

    it('registeredProviders query key는 안정적이다', () => {
        expect(QUERY_KEYS.registeredProviders()).toEqual([
            'llm',
            'registered-providers',
        ]);
    });
});

describe('QUERY_KEYS.financialsAnalysis', () => {
    const MODEL_ID = 'gemini-2.5-flash' as ModelId;

    it('key 배열은 [prefix, UPPER_SYMBOL, modelId, reasoning] 형태이다', () => {
        expect(QUERY_KEYS.financialsAnalysis('aapl', MODEL_ID)).toEqual([
            'financials-analysis',
            'AAPL',
            MODEL_ID,
            false,
        ]);
    });

    it('reasoning=true는 reasoning=false(기본)와 다른 키를 만든다 (member-reasoning-toggle spec)', () => {
        const off = QUERY_KEYS.financialsAnalysis('AAPL', MODEL_ID, false);
        const on = QUERY_KEYS.financialsAnalysis('AAPL', MODEL_ID, true);
        expect(off).not.toEqual(on);
        expect(QUERY_KEYS.financialsAnalysis('AAPL', MODEL_ID)).toEqual(off);
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

describe('QUERY_KEYS — 나머지 키 팩토리', () => {
    const MODEL_ID = 'gemini-2.5-flash' as ModelId;
    const TIMEFRAME: Timeframe = '1Day';
    const DASHBOARD_TF: DashboardTimeframe = '1Day';

    it('bars: symbol 대문자 정규화 + fmpSymbol 포함', () => {
        expect(QUERY_KEYS.bars('aapl', TIMEFRAME, 'AAPL')).toEqual([
            'bars',
            'AAPL',
            '1Day',
            'AAPL',
        ]);
    });

    it('barsPrefix: fmpSymbol 없이 [bars, UPPER_SYMBOL, timeframe]', () => {
        expect(QUERY_KEYS.barsPrefix('aapl', TIMEFRAME)).toEqual([
            'bars',
            'AAPL',
            TIMEFRAME,
        ]);
    });

    it('tickerSearch: 쿼리 문자열을 그대로 포함한다', () => {
        expect(QUERY_KEYS.tickerSearch('apple')).toEqual([
            'ticker-search',
            'apple',
        ]);
    });

    it('assetInfo: symbol 대문자 정규화', () => {
        expect(QUERY_KEYS.assetInfo('tsla')).toEqual(['asset-info', 'TSLA']);
    });

    it('briefing: jobId를 그대로 포함한다', () => {
        expect(QUERY_KEYS.briefing('job-123')).toEqual(['briefing', 'job-123']);
    });

    it('macroBriefingPoll: jobId를 포함한다', () => {
        expect(QUERY_KEYS.macroBriefingPoll('job-abc')).toEqual([
            'macro-briefing-poll',
            'job-abc',
        ]);
    });

    it('fundamentalAnalysis: symbol 대문자 정규화 + modelId + reasoning(기본 false)', () => {
        expect(QUERY_KEYS.fundamentalAnalysis('aapl', MODEL_ID)).toEqual([
            'fundamental-analysis',
            'AAPL',
            MODEL_ID,
            false,
        ]);
    });

    it('congressTrend: symbol 대문자 정규화 + modelId + reasoning(기본 false)', () => {
        expect(QUERY_KEYS.congressTrend('aapl', MODEL_ID)).toEqual([
            'congress-trend',
            'AAPL',
            MODEL_ID,
            false,
        ]);
    });

    it('newsAnalysis: symbol 대문자 정규화 + companyName + modelId + reasoning(기본 false)', () => {
        expect(QUERY_KEYS.newsAnalysis('aapl', 'Apple Inc.', MODEL_ID)).toEqual(
            ['news-analysis', 'AAPL', 'Apple Inc.', MODEL_ID, false]
        );
    });

    it('newsAnalysis: reasoning=true는 다른 키를 만든다', () => {
        const on = QUERY_KEYS.newsAnalysis(
            'aapl',
            'Apple Inc.',
            MODEL_ID,
            true
        );
        expect(on).toEqual([
            'news-analysis',
            'AAPL',
            'Apple Inc.',
            MODEL_ID,
            true,
        ]);
    });

    it('newsAnalysisPrefix: 모든 modelId/reasoning 변형을 무효화하는 prefix', () => {
        expect(QUERY_KEYS.newsAnalysisPrefix('aapl')).toEqual([
            'news-analysis',
            'AAPL',
        ]);
    });

    it('overallAnalysis: symbol 대문자 + companyName + timeframe + modelId + reasoning(기본 false)', () => {
        expect(
            QUERY_KEYS.overallAnalysis(
                'aapl',
                'Apple Inc.',
                TIMEFRAME,
                MODEL_ID
            )
        ).toEqual([
            'overall-analysis',
            'AAPL',
            'Apple Inc.',
            TIMEFRAME,
            MODEL_ID,
            false,
        ]);
    });

    it('sectorSignals: timeframe을 포함한다', () => {
        expect(QUERY_KEYS.sectorSignals(DASHBOARD_TF)).toEqual([
            'sector-signals',
            DASHBOARD_TF,
        ]);
    });

    it('optionsSnapshot: symbol 대문자 정규화', () => {
        expect(QUERY_KEYS.optionsSnapshot('aapl')).toEqual([
            'options-snapshot',
            'AAPL',
        ]);
    });

    it('optionsAnalysis: symbol + companyName + expirationDate + modelId + reasoning(기본 false)', () => {
        expect(
            QUERY_KEYS.optionsAnalysis(
                'aapl',
                'Apple Inc.',
                '2025-01-17',
                MODEL_ID
            )
        ).toEqual([
            'options-analysis',
            'AAPL',
            'Apple Inc.',
            '2025-01-17',
            MODEL_ID,
            false,
        ]);
    });
});
