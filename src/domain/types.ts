import type {
    ChatMessage,
    FearGreedConfidence,
    NewsCategory,
    NewsImpact,
    NewsSentiment,
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
    | 'ev-mobility'
    | 'energy-industrial';

/** Curated ticker category (id + label + member tickers). */
export interface TickerCategory {
    id: CategoryId;
    label: string;
    tickers: readonly string[];
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
} from '@/domain/auth/formTypes';

export type { AuthUserRecord } from '@/domain/auth/types';

export type {
    ApiKeyActionState,
    GateMode,
    RegisteredProvider,
} from '@/domain/llm/types';
export type { LlmProvider } from '@/domain/llm/constants';

export type {
    AnalysisGateError,
    AnalysisGateBlockedResult,
    AnalysisGateErrorCode,
} from '@/domain/analysis/gate';

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
// infrastructure/db/newsRepository.NewsRow — lives in domain because it is the only
// layer importable by both components/ and infrastructure/.
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

/** Chat display history union — `ChatMessage` (LLM-bound) + UI-only `ContextSwitchMessage`. */
export type DisplayMessage = ChatMessage | ContextSwitchMessage;

export type JobType = 'analysis' | 'fundamental' | 'news' | 'options' | 'overall';
export interface CancelJobEntry {
    jobId: string;
    type: JobType;
}
export interface CancelJobsBody {
    jobs: CancelJobEntry[];
}
