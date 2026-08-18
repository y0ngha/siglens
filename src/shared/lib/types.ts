import type {
    ChatMessage,
    FearGreedConfidence,
    MarketSummaryData,
    NewsCategory,
    NewsImpact,
    NewsSentiment,
    RunBriefingResult,
    RunMacroBriefingResult,
} from '@y0ngha/siglens-core';

/**
 * `FearGreedSnapshot.confidence`의 narrowed 형태(`'normal' | 'limited'`).
 * core는 `FearGreedConfidence`에 `'insufficient'`를 포함하지만, snapshot이 반환되는
 * 시점에는 이미 그 케이스가 걸러져 있다(composition.ts의 LIMITED gate). UI 컴포넌트
 * 와 lib/fearGreedLabels의 `formatConfidenceFooter`에서 공통으로 사용.
 */
export type SnapshotConfidence = Exclude<FearGreedConfidence, 'insufficient'>;

/** All OAuth providers known to the system (including those reserved but not yet active in the UI). */
export type OAuthProvider = 'google' | 'kakao' | 'apple';

/** siglens 앱에서 현재 활성화된 OAuth provider. */
export type SupportedOAuthProvider = Extract<OAuthProvider, 'google'>;

/** Common ticker fields shared by listing/search results. */
export interface TickerBase {
    /** Canonical ticker symbol (uppercase). */
    symbol: string;
    /** English company name. */
    name: string;
    /** Short exchange code (e.g. `"NASDAQ"`). */
    exchange: string;
    /** Full exchange name (e.g. `"NASDAQ Global Select"`). */
    exchangeFullName: string;
}

/** Ticker entry with a guaranteed Korean translation. */
export interface KoreanTickerEntry extends TickerBase {
    koreanName: string;
}

/** Ticker search hit; Korean translation may be missing for a brand-new symbol. */
export interface TickerSearchResult extends TickerBase {
    /** Korean company name; absent when no translation is in the store yet. */
    koreanName?: string;
    /**
     * Market profile id — populated for crypto results returned from the
     * crypto_assets store so consumers can render exchange/profile badges
     * correctly without a secondary lookup.
     */
    marketProfile?: MarketProfileId;
}

/** Asset metadata returned by `getAssetInfo`. */
export interface AssetInfo {
    /** Canonical ticker symbol (uppercase). */
    symbol: string;
    /** English company name. */
    name: string;
    /** Korean company name; absent when no translation is in the store yet. */
    koreanName?: string;
    /** FMP API 심볼 (지수의 경우 ^ 접두사 포함, 예: ^SPX). 일반 주식은 undefined. */
    fmpSymbol?: string;
    /**
     * Market profile id. Absent on legacy/equity rows — resolve with
     * `marketProfileOf()` which defaults to `'us-equity'`. Populated for
     * crypto in the routing/data plan (Plan 2).
     */
    marketProfile?: MarketProfileId;
}

/** 카드 칩 하나 — 심볼 + 한글 표시명. */
export interface TickerItem {
    symbol: string;
    name: string;
}

/** Curated category id used to group tickers in UI explorers. */
export type CategoryId =
    | 'megacap'
    | 'ai-semiconductor'
    | 'software-cloud'
    | 'fintech-crypto'
    | 'leveraged-etf'
    | 'healthcare-bio'
    | 'quantum-computing'
    | 'space'
    | 'ev-mobility'
    | 'energy-industrial'
    | 'korea-equity';

/** Curated ticker category (id + label + member tickers with Korean names). */
export interface TickerCategory {
    id: CategoryId;
    label: string;
    items: readonly TickerItem[];
}

/** 암호화폐 큐레이션 카테고리 id. */
export type CryptoCategoryId = 'major' | 'altcoin';

/** 암호화폐 큐레이션 카테고리(id + label + 멤버 심볼/한글명). */
export interface CryptoCategory {
    id: CryptoCategoryId;
    label: string;
    items: readonly TickerItem[];
}

export type {
    DeleteAccountFormErrorCode,
    DeleteAccountFormState,
    FinalizeOAuthSignupState,
    ForgotPasswordFormState,
    LocalInfraErrorCode,
    LoginFormState,
    RequestEmailVerificationFormState,
    ResetPasswordFormState,
    SignupFormState,
    VerifyEmailFormState,
} from '@/shared/lib/auth/formTypes';

export type { AuthUserRecord } from '@/shared/lib/auth/types';

import type { LlmProvider } from '@/shared/config/llmProviders';
// Direct import from /types (not the barrel) to avoid a circular dependency:
// shared/lib/types → marketProfile/index(barrel) → registry → shared/lib/types
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

export type { LlmProvider };

export type GateMode = 'auth' | 'byok';

export type ApiKeyActionStatus = 'idle' | 'success' | 'error';

export type ApiKeyActionErrorCode =
    | 'invalid_key_format'
    | 'server_misconfigured'
    | 'storage_unavailable'
    | 'unknown';

export interface ApiKeyActionState {
    status: ApiKeyActionStatus;
    message: string | null;
    /** Present only when `status === 'error'`. */
    code?: ApiKeyActionErrorCode;
}

export interface RegisteredProvider {
    provider: LlmProvider;
    updatedAt: Date;
}

/** Machine-readable codes for siglens-side analysis gate denials. */
export type AnalysisGateErrorCode =
    | 'tier_premium_blocked'
    | 'invalid_model'
    | 'api_key_corrupted'
    | 'unexpected_error';

/** Structured gate error returned from action layer. */
export interface AnalysisGateError {
    code: AnalysisGateErrorCode;
    message: string;
}

/** Gate denial result — mirrors core's `{ status: 'error' }` discriminator. */
export interface AnalysisGateBlockedResult {
    status: 'error';
    error: AnalysisGateError;
}

/**
 * UI-level expiration filter value.
 *
 * The `(string & {})` intersection prevents TypeScript from widening the
 * union to bare `string` (which would drop the `'all'` autocomplete in
 * IDEs and erase the literal hint at call sites). Runtime behavior is
 * identical to `string | 'all'`; this trick is purely an editor-DX guard.
 * Mirrors siglens-core's OptionsExpirationFilter for consistency.
 */
export type OptionsExpirationSelector = (string & {}) | 'all';

export type ContactFormField = 'title' | 'email' | 'content';

export type ContactFormErrorCode =
    | 'title_required'
    | 'title_too_long'
    | 'email_required'
    | 'email_invalid'
    | 'content_required'
    | 'content_too_long'
    | 'submission_failed';

export interface ContactFormError {
    code: ContactFormErrorCode;
    field?: ContactFormField;
}

export interface ContactFormValues {
    title: string;
    email: string;
    content: string;
}

export interface ContactFormState {
    submitted: boolean;
    error: ContactFormError | null;
    values: ContactFormValues;
}

export interface PwaEnvironment {
    isMobile: boolean;
    isIos: boolean;
    isInAppBrowser: boolean;
    isStandalone: boolean;
}

// Cross-layer news field set shared by components/news/sections/NewsList.tsx and
// entities/news-article/api.NewsRow — lives in domain because it is the only
// layer importable by both components/ and entities/.
export interface NewsDisplayItem {
    id: string;
    publishedAt: string;
    titleEn: string;
    titleKo: string | null;
    sentiment: NewsSentiment | null;
    category: NewsCategory | null;
    bodyKo: string | null;
    summaryKo: string | null;
    priceImpact: NewsImpact | null;
    url: string;
    source: string;
}

export type EarningsReportPeriod = 'past' | 'future';
export type EarningsReportComparisonSlot =
    | 'past-2'
    | 'past-1'
    | 'recent-or-future';

/** Cross-layer earnings report row used by DB fetch-through and the news-page comparison chart. */
export interface EarningsReportComparisonItem {
    symbol: string;
    earningsDate: string;
    epsActual: number | null;
    epsEstimated: number | null;
    revenueActual: number | null;
    revenueEstimated: number | null;
    lastUpdated: string | null;
    period: EarningsReportPeriod;
    slot: EarningsReportComparisonSlot;
}

/** UI-only system message emitted on chatbot page-context switch; filtered out before LLM prompt construction. */
export interface ContextSwitchMessage {
    role: 'system';
    kind: 'context_switch';
    /** Korean label of the page the chatbot context switched to. */
    label: string;
}

/**
 * Chat display history union — `ChatMessage` (LLM-bound) + UI-only `ContextSwitchMessage`.
 *
 * `uiId`는 렌더 전용 식별자다. 채팅은 append-only라 인덱스를 key로 써도 눈에 띄는 버그는
 * 없었지만, 같은 내용의 메시지가 반복될 수 있어 내용 기반 key도 쓸 수 없다(중복 key).
 * `ChatMessage`는 @y0ngha/siglens-core 소유 타입이라 필드를 추가할 수 없으므로,
 * 표시 계층에서만 id를 부여하고 LLM 전송·localStorage 저장 전에 제거한다.
 */
export type DisplayMessage = (ChatMessage | ContextSwitchMessage) & {
    uiId: string;
};

/** summary 전용 결과 — briefing/botBlocked는 별도 경로(MarketBriefingActionResult). */
export type MarketSummaryActionResult =
    | { summary: MarketSummaryData }
    | { ok: false; error: string };

/** briefing 클라 경로 결과 — 봇 차단 또는 cached/done. */
export type MarketBriefingActionResult =
    | { briefing: RunBriefingResult; botBlocked: false }
    | { briefing: null; botBlocked: true }
    | { ok: false; error: string };

/** /economy 거시 브리핑 클라 경로 결과 — market briefing 패턴 미러. */
export type MacroBriefingActionResult =
    | { briefing: RunMacroBriefingResult; botBlocked: false }
    | { briefing: null; botBlocked: true }
    | { ok: false; error: string };
