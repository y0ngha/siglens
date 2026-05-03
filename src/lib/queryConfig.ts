import type { Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_MINUTE } from '@/domain/constants/time';

/** Default cache freshness for queries without a domain-specific cadence. */
export const QUERY_STALE_TIME_MS = MS_PER_MINUTE;
export const QUERY_GC_TIME_MS = 300_000;

/**
 * Market summary refreshes during U.S. market hours; 1 minute keeps the
 * dashboard responsive without thrashing the FMP free-tier rate limit.
 */
export const MARKET_SUMMARY_STALE_TIME_MS = MS_PER_MINUTE;

/**
 * Ticker autocomplete results change rarely (FMP catalogue updates daily).
 * 5 minutes is well within FMP free-tier headroom and avoids re-querying
 * during a typing session.
 */
export const TICKER_SEARCH_STALE_TIME_MS = 5 * MS_PER_MINUTE;

/**
 * Korean-translation lookups for tickers are immutable once cached on the
 * server; client-side staleness can be aggressive.
 */
export const KOREAN_TRANSLATION_STALE_TIME_MS = 60 * MS_PER_MINUTE;

/**
 * Asset metadata (sector, industry, fmpSymbol) changes infrequently. Long
 * staleness keeps repeated symbol-page navigations cache-warm.
 */
export const ASSET_INFO_STALE_TIME_MS = 30 * MS_PER_MINUTE;

/**
 * OHLCV bar data updates every 30 seconds during market hours (Alpaca cadence).
 * Use a short staleTime so chart repaints reflect the latest bar without
 * re-fetching mid-render.
 */
export const BARS_STALE_TIME_MS = 30_000;

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
} as const;
