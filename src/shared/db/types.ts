import 'server-only';

import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { Tier } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/shared/lib/types';
import type { LlmProvider } from '../config/llmProviders';
import type { KoreanTickerEntry } from '@/shared/lib/types';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import type * as schema from './schema';

export type { AuthUserRecord };

/** Connection configuration required to instantiate a database client. */
export interface DatabaseConfig {
    /** PostgreSQL connection string, including credentials and SSL mode. */
    databaseUrl: string;
}

/** Fully-typed Drizzle ORM database instance scoped to the siglens schema (tied to `drizzle-orm/neon-http`). */
export type SiglensDatabase = NeonHttpDatabase<typeof schema>;

/** @internal Raw Neon serverless SQL client — access via DatabaseClient['sql']. */
export type NeonSqlClient = NeonQueryFunction<false, false>;

/** Bundled handle exposing both the Drizzle ORM layer and the raw SQL client. */
export interface DatabaseClient {
    /** Drizzle ORM instance scoped to the siglens schema. */
    db: SiglensDatabase;
    /** Raw Neon serverless SQL client for template-literal queries. */
    sql: NeonSqlClient;
}

/** Email-auth user record including the password hash needed for credential checks. */
export interface EmailAuthUserRecord extends AuthUserRecord {
    /** Hashed password for email/password authentication; null for OAuth-only users. */
    passwordHash: string | null;
}

/** Persisted auth session record. */
export interface AuthSessionRecord {
    /** Session identifier used as the session token. */
    id: string;
    /** User that owns the session. */
    userId: string;
    /** Fixed expiration timestamp. */
    expiresAt: Date;
    /** Timestamp when the session was created. */
    createdAt: Date;
}

/** Input for creating a new email-based user account. */
export interface CreateEmailUserInput {
    /** Normalized email address (lowercased, trimmed). */
    email: string;
    /** Hashed password produced by the password hasher. */
    passwordHash: string;
    /** Optional display name; `null` stores an explicit empty profile value. */
    name?: string | null;
    /** Optional avatar image URL; `null` stores an explicit empty profile value. */
    avatarUrl?: string | null;
    /**
     * Whether the email address was verified prior to account creation.
     * Defaults to `false` when omitted; set to `true` when the verification
     * flow has confirmed ownership of the address.
     */
    emailVerified?: boolean;
}

/** Input for creating a new OAuth-based user account and provider link. */
export interface CreateOAuthUserInput {
    /** Normalized email address (lowercased, trimmed). */
    email: string;
    /** OAuth provider that authenticated the account. */
    provider: OAuthProvider;
    /** Stable provider-side account identifier. */
    providerAccountId: string;
    /** Optional display name. */
    name?: string;
    /** Optional avatar image URL. */
    avatarUrl?: string;
    /** Optional plain-text access token to encrypt and store. */
    accessToken?: string;
    /** Optional plain-text refresh token to encrypt and store. */
    refreshToken?: string;
    /** Optional token expiration timestamp. */
    tokenExpiresAt?: Date;
}

/**
 * A persisted OAuth account record returned from the database.
 * Tokens are decrypted from AES-256-GCM ciphertext before being returned.
 */
export interface OAuthAccountRecord {
    /** Unique account row identifier. */
    id: string;
    /** User that owns this linked account. */
    userId: string;
    /** OAuth provider for the linked account. */
    provider: OAuthProvider;
    /** Stable provider-side account identifier. */
    providerAccountId: string;
    /** Plain-text access token; null when not stored or decryption key is absent. */
    accessToken: string | null;
    /** Plain-text refresh token; null when not stored or decryption key is absent. */
    refreshToken: string | null;
    /** Token expiration timestamp; null when not stored. */
    tokenExpiresAt: Date | null;
    /** Timestamp when the row was created. */
    createdAt: Date;
}

/** Input for creating a new persisted session. */
export interface CreateSessionInput {
    /** User that owns the session. */
    userId: string;
    /** Fixed expiration timestamp. */
    expiresAt: Date;
}

/** Interface for user persistence operations required by the auth use-cases. */
export interface UserRepository {
    findByEmail(email: string): Promise<AuthUserRecord | null>;
    findById(userId: string): Promise<AuthUserRecord | null>;
    createEmailUser(
        input: CreateEmailUserInput
    ): Promise<AuthUserRecord | null>;
    deleteUser(userId: string): Promise<boolean>;
    updatePassword(userId: string, passwordHash: string): Promise<boolean>;
}

/** Interface for credential lookup required by email login. */
export interface EmailAuthUserRepository {
    findEmailAuthUserByEmail(
        email: string
    ): Promise<EmailAuthUserRecord | null>;
}

/** Interface for OAuth login account lookup and creation. */
export interface OAuthUserRepository {
    findByOAuthAccount(
        provider: OAuthProvider,
        providerAccountId: string
    ): Promise<AuthUserRecord | null>;
    findByEmail(email: string): Promise<AuthUserRecord | null>;
    createOAuthUser(
        input: CreateOAuthUserInput
    ): Promise<AuthUserRecord | null>;
}

/** Interface for session persistence operations. */
export interface SessionRepository {
    createSession(input: CreateSessionInput): Promise<AuthSessionRecord>;
    findSession(sessionToken: string): Promise<AuthSessionRecord | null>;
    deleteSession(sessionToken: string): Promise<boolean>;
    /** Bulk-delete sessions where `expiresAt < now`; returns deleted count. Intended for cron/admin routes only — never on the request hot path. */
    deleteExpiredSessions(now?: Date): Promise<number>;
}

/** Persistence operations for the OAuth account store. */
export interface OAuthAccountRepository {
    findByUserId(userId: string): Promise<OAuthAccountRecord[]>;
}

/** Persistence operations required by tier-gating use-cases. */
export interface UserTierRepository {
    getUserTier(userId: string): Promise<Tier | null>;
    updateUserTier(userId: string, tier: Tier): Promise<Tier | null>;
}

/**
 * Metadata for a stored user API key. Plaintext is intentionally omitted so
 * list-style operations (`findByUser`) cannot leak secrets through logs or UI.
 */
export interface UserApiKeyMetaRecord {
    id: string;
    userId: string;
    provider: LlmProvider;
    createdAt: Date;
    updatedAt: Date;
}

/** A stored user API key including the decrypted plaintext value. */
export interface UserApiKeyRecord extends UserApiKeyMetaRecord {
    apiKey: string;
}

/** Input for inserting or replacing a user's API key for one provider. */
export interface UpsertUserApiKeyInput {
    userId: string;
    provider: LlmProvider;
    apiKey: string;
}

/** Persistence operations for user-supplied LLM API keys. */
export interface UserApiKeyRepository {
    upsert(input: UpsertUserApiKeyInput): Promise<UserApiKeyMetaRecord>;
    findByUser(userId: string): Promise<UserApiKeyMetaRecord[]>;
    findByUserAndProvider(
        userId: string,
        provider: LlmProvider
    ): Promise<UserApiKeyRecord | null>;
    deleteByUserAndProvider(
        userId: string,
        provider: LlmProvider
    ): Promise<boolean>;
}

/** A persisted portfolio holding row — one row per (user, symbol); the user inputs the average price directly (not a lot ledger). */
export interface PortfolioHoldingRecord {
    id: string;
    userId: string;
    symbol: string; // canonical UPPERCASE
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string; // decimal string (numeric(24,8))
    averagePrice: string; // decimal string (numeric(20,8))
    createdAt: Date;
    updatedAt: Date;
}

/** Input for inserting or replacing a user's holding for one symbol. */
export interface UpsertPortfolioHoldingInput {
    userId: string;
    symbol: string; // caller passes canonical UPPERCASE
    companyName: string | null;
    fmpSymbol: string | null;
    quantity: string;
    averagePrice: string;
}

/** Persistence operations for member portfolio holdings. */
export interface PortfolioHoldingRepository {
    findByUser(userId: string): Promise<PortfolioHoldingRecord[]>;
    /** Forward-provisioned for subsystems B/C (spec §4); no production caller yet. */
    findByUserAndSymbol(
        userId: string,
        symbol: string
    ): Promise<PortfolioHoldingRecord | null>;
    upsert(input: UpsertPortfolioHoldingInput): Promise<PortfolioHoldingRecord>;
    deleteByUserAndSymbol(userId: string, symbol: string): Promise<boolean>;
}

/** `korean_tickers`의 상장 상태만 담은 최소 행. 상폐 판정 로직(`planKrTickerReconcile`,
 * `entities/ticker/lib/krTickerReconcile.ts`)의 입력 타입이다 — 그 로직은 entity
 * 레이어에 있지만 이 타입은 {@link KoreanTickerRepository}의 반환 타입이라 다른
 * repository 타입들과 함께 여기 둔다(entity → shared 참조만 발생, 역방향 없음).
 */
export interface KrTickerListingRow {
    symbol: string;
    /** `null`이면 상장 중. 값이 있으면 그 시점에 상폐로 표시됐다. */
    delistedAt: Date | null;
}

/**
 * `upsertMany`의 conflict-update 동작을 조절하는 옵션.
 *
 * `korean_tickers.name`을 쓰는 호출부는 서로 상반된 요구를 가진다:
 * - 번역 경로(`koreanNameStore.setKoreanTickers`, `getAssetInfo` 방문 시 채움)는
 *   yahoo quote에서 얻은 **진짜 영문명**을 쓰는 게 목적이다 — 그래서 옵션 없이
 *   (기본값 `false`) `name`을 그대로 덮어써야 한다.
 * - 상장종목 동기화 경로(`syncKrListedTickers`)가 넘기는 `name`은 공공데이터포털
 *   응답에 영문명이 없어 채운 **한글명 placeholder**다(`toKoreanTickerRows` 참조).
 *   이 경로가 옵션 없이 upsert하면, 방문 시 번역 경로가 이미 써 둔 진짜 영문명을
 *   placeholder가 매일 밤 되돌린다 — 이게 이 옵션이 존재하는 이유다.
 *
 * 두 경로가 각자 다른 이유로 이 옵션을 켜고 끄므로, 나중에 "어차피 upsertMany 하나인데"
 * 하고 옵션을 없애 합치면 위 회귀가 재발한다.
 */
export interface KoreanTickerUpsertOptions {
    /** `true`면 conflict 시 기존 행의 `name`을 덮어쓰지 않는다. 신규 INSERT에는 영향 없음 — placeholder라도 null보다는 낫다. */
    preserveExistingName?: boolean;
}

/**
 * Persistence operations for the Korean ticker store. Backs the bilingual
 * search and asset metadata flows by exposing the cached `korean_tickers` rows.
 */
export interface KoreanTickerRepository {
    /**
     * Currently-listed rows only. This backs Korean-name search, so a delisted
     * ticker must not surface here — it would rank in the suggestion list and
     * lead to a dead page.
     */
    findAll(): Promise<KoreanTickerEntry[]>;
    /**
     * Rows for the given symbols **including delisted ones**. Name resolution for
     * a symbol the caller already holds is a display concern, not a discovery
     * one — a visitor on a delisted symbol's URL should still see its Korean name.
     */
    findBySymbols(symbols: readonly string[]): Promise<KoreanTickerEntry[]>;
    /** `options.preserveExistingName`는 {@link KoreanTickerUpsertOptions} 참조. */
    upsertMany(
        entries: readonly KoreanTickerEntry[],
        options?: KoreanTickerUpsertOptions
    ): Promise<void>;
    /** Every row's symbol and listing status — the reconcile planner's input. */
    findAllListingStatuses(): Promise<KrTickerListingRow[]>;
    /** Stamp `delisted_at = now()` on rows that are still marked as listed. */
    markDelisted(symbols: readonly string[]): Promise<void>;
    /** Clear `delisted_at` on symbols observed as listed again. */
    markRelisted(symbols: readonly string[]): Promise<void>;
}

/**
 * A persisted asset-translation row mapping the canonical (cashtag) symbol
 * to the FMP-provided symbol, English name, and Korean translation.
 */
export interface AssetTranslationRecord {
    /** Canonical uppercase symbol (e.g. `"AAPL"`). */
    symbol: string;
    /** English company name returned by FMP. */
    name: string;
    /** Korean translation produced by the translator. */
    koreanName: string;
    /** FMP-side symbol; equals `symbol` for normal U.S. equities, may differ for indices. */
    fmpSymbol: string;
}

/** Persistence operations backing {@link AssetTranslationRecord}. */
export interface AssetTranslationRepository {
    findBySymbol(symbol: string): Promise<AssetTranslationRecord | null>;
    upsert(record: AssetTranslationRecord): Promise<void>;
}

/** A persisted company description translation row. */
export interface ProfileDescriptionTranslationRecord {
    /** Canonical uppercase symbol (e.g. `"AAPL"`). */
    symbol: string;
    /** Korean translation of the FMP company description. */
    descriptionKo: string;
}

/** Persistence operations for company description Korean translations. */
export interface ProfileDescriptionTranslationRepository {
    findBySymbol(
        symbol: string
    ): Promise<ProfileDescriptionTranslationRecord | null>;
    upsert(record: ProfileDescriptionTranslationRecord): Promise<void>;
}

/** 'dict' | 'ai' — indicator 번역 출처. */
export type IndicatorTranslationSource = 'dict' | 'ai';

/** 경제 지표명 한국어 번역 캐시 행. */
export interface IndicatorTranslationRecord {
    /** 정규화된 base 지표명(접미 괄호 제거). 예 'Core PCE Price Index YoY'. */
    normalizedName: string;
    /** 한국어 번역. */
    koreanName: string;
    /** 'dict'(코드 승격) | 'ai'(core 번역 캐시). */
    source: IndicatorTranslationSource;
}

/** {@link IndicatorTranslationRecord}를 백킹하는 영속화 연산. */
export interface IndicatorTranslationRepository {
    findByNames(
        normalizedNames: readonly string[]
    ): Promise<IndicatorTranslationRecord[]>;
    upsert(record: IndicatorTranslationRecord): Promise<void>;
}

/** A row from the crypto_assets table. */
export interface CryptoAssetRecord {
    symbol: string;
    name: string;
    koreanName: string | null;
    circulatingSupply: number | null;
}

/** Read/search access to the crypto_assets universe. */
export interface CryptoAssetRepository {
    findBySymbol(symbol: string): Promise<CryptoAssetRecord | null>;
    /** Prefix/substring match over symbol + name, ordered by circulatingSupply desc, capped. */
    search(query: string, limit: number): Promise<CryptoAssetRecord[]>;
}
