/** All OAuth providers known to the system (including those reserved but not yet active in the UI). */
export type OAuthProvider = 'google' | 'kakao' | 'apple';

/** siglens 앱에서 현재 활성화된 OAuth provider. */
export type SupportedOAuthProvider = Extract<OAuthProvider, 'google' | 'kakao'>;

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
