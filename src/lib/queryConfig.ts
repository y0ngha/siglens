import type { ModelId, Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_MINUTE } from '@/domain/constants/time';

/** Default cache freshness for queries without a domain-specific cadence. */
export const QUERY_STALE_TIME_MS = MS_PER_MINUTE;
export const QUERY_GC_TIME_MS = 300_000;

/** Market summary refreshes during U.S. market hours; 1 minute fits FMP free-tier rate limits. */
export const MARKET_SUMMARY_STALE_TIME_MS = MS_PER_MINUTE;

/** FMP ticker catalogue updates daily; 5 min avoids re-querying during a typing session. */
export const TICKER_SEARCH_STALE_TIME_MS = 5 * MS_PER_MINUTE;

/** Korean translations are immutable once cached server-side, so client staleness can be aggressive. */
export const KOREAN_TRANSLATION_STALE_TIME_MS = 60 * MS_PER_MINUTE;

/** Asset metadata (sector/industry/fmpSymbol) changes infrequently; long staleness keeps repeat nav warm. */
export const ASSET_INFO_STALE_TIME_MS = 30 * MS_PER_MINUTE;

/** OHLCV bars update every 30s during market hours (Alpaca cadence). */
export const BARS_STALE_TIME_MS = 30_000;

/**
 * fearGreed snapshot은 underlying bars의 staleTime을 그대로 따라간다 —
 * useBars 결과로부터 즉석 산출하므로 자체 staleTime은 의미 없다. 별도 상수 미정의.
 */

/** The current user's tier rarely changes within a session. */
export const USER_TIER_STALE_TIME_MS = 5 * MS_PER_MINUTE;

export const QUERY_KEYS = {
    bars: (symbol: string, timeframe: Timeframe) =>
        ['bars', symbol, timeframe] as const,
    tickerSearch: (query: string) => ['ticker-search', query] as const,
    assetInfo: (symbol: string) => ['asset-info', symbol] as const,
    briefing: (jobId: string) => ['briefing', jobId] as const,
    marketSummary: () => ['market-summary'] as const,
    currentUser: () => ['current-user'] as const,
    userTier: () => ['user-tier'] as const,
    remainingTokens: () => ['chat', 'remaining-tokens'] as const,
    registeredProviders: () => ['llm', 'registered-providers'] as const,
    fundamentalAnalysis: (symbol: string, modelId: ModelId) =>
        ['fundamental-analysis', symbol, modelId] as const,
    // News augment (chart page) and news analysis (news page) share this key so
    // a single React Query entry serves both pages within a session — preventing
    // a duplicate fetch when the user navigates between /AAPL and /AAPL/news.
    // Augment consumers may use `select` to project to a narrower shape.
    newsAnalysis: (symbol: string, modelId: ModelId) =>
        ['news-analysis', symbol, modelId] as const,
    /** Prefix key — invalidates all modelId variants for a symbol at once. */
    newsAnalysisPrefix: (
        symbol: string
    ): readonly ['news-analysis', string] => ['news-analysis', symbol],
    overallAnalysis: (
        symbol: string,
        companyName: string,
        timeframe: Timeframe,
        modelId: ModelId
    ) => ['overall-analysis', symbol, companyName, timeframe, modelId] as const,
} as const;
