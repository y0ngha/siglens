import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type {
    LlmProvider,
    OAuthProvider,
    Tier,
} from '@y0ngha/siglens-core';
import type { KoreanTickerEntry } from '@/domain/types';
import type { AuthUserRecord } from '@/domain/auth/types';
import type * as schema from '@/infrastructure/db/schema';

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

/**
 * Persistence operations for the Korean ticker store. Backs the bilingual
 * search and asset metadata flows by exposing the cached `korean_tickers` rows.
 */
export interface KoreanTickerRepository {
    findAll(): Promise<KoreanTickerEntry[]>;
    findBySymbols(symbols: readonly string[]): Promise<KoreanTickerEntry[]>;
    upsertMany(entries: readonly KoreanTickerEntry[]): Promise<void>;
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
