import type { ModelId, Timeframe } from '@y0ngha/siglens-core';
import { MS_PER_MINUTE } from './time';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

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

/** Current user identity rarely changes within a session; matches USER_TIER for consistency. */
export const CURRENT_USER_STALE_TIME_MS = 5 * MS_PER_MINUTE;

/** Registered LLM providers list refreshes only after the user adds/removes a key — short stale is fine. */
export const REGISTERED_PROVIDERS_STALE_TIME_MS = MS_PER_MINUTE;

const upper = (s: string): string => s.toUpperCase();

export const QUERY_KEYS = {
    bars: (symbol: string, timeframe: Timeframe, fmpSymbol?: string) =>
        ['bars', upper(symbol), timeframe, fmpSymbol] as const,
    /** Prefix key — cancels/invalidates all fmpSymbol variants for a symbol+timeframe. */
    barsPrefix: (
        symbol: string,
        timeframe: Timeframe
    ): readonly ['bars', string, Timeframe] => [
        'bars',
        upper(symbol),
        timeframe,
    ],
    tickerSearch: (query: string) => ['ticker-search', query] as const,
    assetInfo: (symbol: string) => ['asset-info', upper(symbol)] as const,
    briefing: (jobId: string) => ['briefing', jobId] as const,
    marketSummary: () => ['market-summary'] as const,
    marketBriefing: () => ['market-briefing'] as const,
    currentUser: () => ['current-user'] as const,
    userTier: () => ['user-tier'] as const,
    remainingTokens: () => ['chat', 'remaining-tokens'] as const,
    registeredProviders: () => ['llm', 'registered-providers'] as const,
    fundamentalAnalysis: (symbol: string, modelId: ModelId) =>
        ['fundamental-analysis', upper(symbol), modelId] as const,
    // News augment (chart page) and news analysis (news page) share this key so
    // a single React Query entry serves both pages within a session — preventing
    // a duplicate fetch when the user navigates between /AAPL and /AAPL/news.
    // Augment consumers may use `select` to project to a narrower shape.
    newsAnalysis: (symbol: string, companyName: string, modelId: ModelId) =>
        ['news-analysis', upper(symbol), companyName, modelId] as const,
    /** Prefix key — invalidates all modelId variants for a symbol at once. */
    newsAnalysisPrefix: (
        symbol: string
    ): readonly ['news-analysis', string] => ['news-analysis', upper(symbol)],
    overallAnalysis: (
        symbol: string,
        companyName: string,
        timeframe: Timeframe,
        modelId: ModelId
    ) =>
        [
            'overall-analysis',
            upper(symbol),
            companyName,
            timeframe,
            modelId,
        ] as const,
    sectorSignals: (timeframe: string) =>
        ['sector-signals', timeframe] as const,
    optionsSnapshot: (symbol: string) =>
        ['options-snapshot', upper(symbol)] as const,
    /**
     * Options analysis cache scope. Expiration date is part of the key because
     * the AI analysis output differs per expiration — the chip selector should
     * trigger a new fetch when the user picks a different expiration.
     */
    optionsAnalysis: (
        symbol: string,
        companyName: string,
        expirationDate: OptionsExpirationSelector,
        modelId: ModelId
    ) =>
        [
            'options-analysis',
            upper(symbol),
            companyName,
            expirationDate,
            modelId,
        ] as const,
} as const;
