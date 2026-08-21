import type {
    DashboardTimeframe,
    ModelId,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { DashboardScopeId } from './dashboardScope';
import type { Locale } from '@/shared/i18n/locales';
import { MS_PER_MINUTE } from './time';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

/** Default cache freshness for queries without a domain-specific cadence. */
export const QUERY_STALE_TIME_MS = MS_PER_MINUTE;
export const QUERY_GC_TIME_MS = 300_000;

/** Market summary refreshes during U.S. market hours; 1 minute fits FMP free-tier rate limits. */
export const MARKET_SUMMARY_STALE_TIME_MS = MS_PER_MINUTE;

/** Sector signals share the same market-hours cadence as the market summary. */
export const SECTOR_SIGNALS_STALE_TIME_MS = MS_PER_MINUTE;

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

/** A member's own holdings change only on their explicit edit — short stale is fine. */
export const PORTFOLIO_HOLDINGS_STALE_TIME_MS = 5 * MS_PER_MINUTE;

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
    /**
     * 시장별로 키를 가른다. `/market`과 `/market/kr`은 같은 클라이언트 캐시를
     * 공유하므로, scope가 키에 없으면 한 페이지에서 다른 페이지로 이동했을 때
     * 이전 시장의 시세가 그대로 보인다(staleTime 안에서는 refetch도 없다).
     */
    marketSummary: (scope: DashboardScopeId) =>
        ['market-summary', scope] as const,
    /**
     * 브리핑 산문도 로케일별로 번역된다(`translateAnalysisForLocale`). 다른 분석
     * 키와 같은 이유로 로케일이 키에 들어가야 한다 — 빠지면 ko에서 본 브리핑이
     * ja 화면에 그대로 재사용된다.
     */
    marketBriefing: (scope: DashboardScopeId, locale: Locale) =>
        ['market-briefing', scope, locale] as const,
    macroBriefing: (locale: Locale) => ['macro-briefing', locale] as const,
    /**
     * 다이제스트 산문도 로케일별로 번역된다. 이 키만 훅에 인라인 리터럴로
     * 있어서 `queryConfig.test.ts`의 팩토리 열거 가드가 **구조적으로 못 봤다**
     * — 로케일이 빠진 채 ko 캐시가 ja 화면에 재사용되고 있었다.
     */
    marketNewsDigest: (category: string, locale: Locale) =>
        ['market-news-digest', category, locale] as const,
    currentUser: () => ['current-user'] as const,
    userTier: () => ['user-tier'] as const,
    remainingTokens: () => ['chat', 'remaining-tokens'] as const,
    registeredProviders: () => ['llm', 'registered-providers'] as const,
    portfolioHoldings: () => ['portfolio-holdings'] as const,
    // exact same key they always have — only a member's explicit `true` value
    // produces a distinct key (member-reasoning-toggle spec Part A: "changing
    // the toggle re-submits analysis" relies on this key change).
    fundamentalAnalysis: (
        symbol: string,
        modelId: ModelId,
        reasoning = false,
        locale: Locale
    ) =>
        [
            'fundamental-analysis',
            upper(symbol),
            modelId,
            reasoning,
            locale,
        ] as const,
    financialsAnalysis: (
        symbol: string,
        modelId: ModelId,
        reasoning = false,
        locale: Locale
    ) =>
        [
            'financials-analysis',
            upper(symbol),
            modelId,
            reasoning,
            locale,
        ] as const,
    congressTrend: (
        symbol: string,
        modelId: ModelId,
        reasoning = false,
        locale: Locale
    ) => ['congress-trend', upper(symbol), modelId, reasoning, locale] as const,
    // News augment (chart page) and news analysis (news page) share this key so
    // a single React Query entry serves both pages within a session — preventing
    // a duplicate fetch when the user navigates between /AAPL and /AAPL/news.
    // Augment consumers may use `select` to project to a narrower shape.
    newsAnalysis: (
        symbol: string,
        companyName: string,
        modelId: ModelId,
        reasoning = false,
        locale: Locale
    ) =>
        [
            'news-analysis',
            upper(symbol),
            companyName,
            modelId,
            reasoning,
            locale,
        ] as const,
    /** Prefix key — invalidates all modelId/reasoning variants for a symbol at once. */
    newsAnalysisPrefix: (
        symbol: string
    ): readonly ['news-analysis', string] => ['news-analysis', upper(symbol)],
    /**
     * ⚠️ **로케일이 키에 들어가야 한다.** AI 분석 산문은 로케일별로 다른
     * 결과다(`translateAnalysisForLocale`). 키에서 빼면 ko에서 본 결과가
     * ja로 전환했을 때 그대로 재사용돼 **일본어 화면에 한국어 분석문**이 남고,
     * 재분석(할당량 소모) 말고는 벗어날 방법이 없다. `QueryClient`가
     * `[locale]/layout.tsx`에 있어 로케일 전환 시 remount되지 않으므로
     * 캐시가 그대로 살아 있다.
     */
    overallAnalysis: (
        symbol: string,
        companyName: string,
        timeframe: Timeframe,
        modelId: ModelId,
        reasoning = false,
        locale: Locale
    ) =>
        [
            'overall-analysis',
            upper(symbol),
            companyName,
            timeframe,
            modelId,
            reasoning,
            locale,
        ] as const,
    sectorSignals: (scope: DashboardScopeId, timeframe: DashboardTimeframe) =>
        ['sector-signals', scope, timeframe] as const,
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
        modelId: ModelId,
        reasoning = false,
        locale: Locale
    ) =>
        [
            'options-analysis',
            upper(symbol),
            companyName,
            expirationDate,
            modelId,
            reasoning,
            locale,
        ] as const,
} as const;
