import 'server-only';

import type { Sql } from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Tier } from '@y0ngha/siglens-core';
import type {
    OAuthProvider,
    KoreanTickerEntry,
    KoreanTickerUpsertEntry,
} from '@/shared/lib/types';
import type { LlmProvider } from '../config/llmProviders';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import type { Locale } from '@/shared/i18n/locales';
import type {
    EmailReportConsentSource,
    MailAlertConsentSourceValue,
    MailAlertTopicKindValue,
    PriceAlertApproachValue,
    PriceAlertBasisValue,
    PriceAlertMarketValue,
    PriceAlertStatusValue,
} from './constants';
import type * as schema from './schema';

/** Connection configuration required to instantiate a database client. */
export interface DatabaseConfig {
    /** PostgreSQL connection string, including credentials and SSL mode. */
    databaseUrl: string;
}

/** Fully-typed Drizzle ORM database instance scoped to the siglens schema (tied to `drizzle-orm/postgres-js`). */
export type SiglensDatabase = PostgresJsDatabase<typeof schema>;

/** Bundled handle exposing both the Drizzle ORM layer and the raw SQL client. */
export interface DatabaseClient {
    /** Drizzle ORM instance scoped to the siglens schema. */
    db: SiglensDatabase;
    /**
     * Raw postgres-js client for template-literal queries. Bypasses the drizzle
     * logger, so it does NOT send the `unstable_noStore` signal — see
     * `noStoreQueryLogger`.
     */
    sql: Sql;
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
    /**
     * 비밀번호 해시를 바꾸고 그 사용자의 세션을 **모두** 지운다(같은 트랜잭션). 반환값은 사용자 행이
     * 바뀌었는지이며, 바뀐 행이 없으면 세션도 건드리지 않는다. 유출된 비밀번호로 만든 세션이
     * 재설정 뒤에도 살아 있지 않게 한다.
     */
    resetPasswordRevokingSessions(
        userId: string,
        passwordHash: string
    ): Promise<boolean>;
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

/** A persisted watchlist row — one row per (user, symbol). */
export interface WatchlistItemRecord {
    id: string;
    userId: string;
    symbol: string; // canonical UPPERCASE
    companyName: string | null;
    createdAt: Date;
}

/** Input for adding (or re-adding) one watchlist symbol. */
export interface AddWatchlistItemInput {
    userId: string;
    symbol: string; // caller passes canonical UPPERCASE
    companyName: string | null;
}

/**
 * Result of `addWithinLimit`.
 * - `created`: false when the symbol was already saved (idempotent upsert).
 * - `limit_reached`: the symbol is new and the member is already at the limit.
 */
export type AddWatchlistResultRecord =
    | { status: 'added'; item: WatchlistItemRecord; created: boolean }
    | { status: 'limit_reached' };

/** One local (anonymous) entry offered to `mergeSymbols`, most recently added first. */
export interface MergeWatchlistCandidate {
    symbol: string; // canonical UPPERCASE
    companyName: string | null;
}

/** `added`: rows inserted. `skipped`: new symbols dropped by the limit (already-present symbols count as neither). */
export interface MergeWatchlistOutcome {
    added: number;
    skipped: number;
}

/** Persistence operations for member watchlists. */
export interface WatchlistItemRepository {
    findByUser(userId: string): Promise<WatchlistItemRecord[]>;
    countByUser(userId: string): Promise<number>;
    /**
     * Upsert under a per-member lock so concurrent adds cannot exceed `limit`. Re-adding an existing
     * symbol is idempotent (limit not applied): the row is kept and `companyName` backfilled only when null.
     */
    addWithinLimit(
        input: AddWatchlistItemInput,
        limit: number
    ): Promise<AddWatchlistResultRecord>;
    remove(userId: string, symbol: string): Promise<boolean>;
    /** Union with the account list; candidates beyond `limit` (in the given order) are skipped. */
    mergeSymbols(
        userId: string,
        candidates: readonly MergeWatchlistCandidate[],
        limit: number
    ): Promise<MergeWatchlistOutcome>;
}

/** A persisted email-report subscription row — one row per user. */
export interface EmailReportSubscriptionRecord {
    userId: string;
    enabled: boolean;
    /** Weekday bitmask — bit n is `Date#getDay()` n (0 = Sunday). */
    daysOfWeek: number;
    /** Local hour (0–23) in `timezone`. */
    sendHour: number;
    /** IANA time zone name. */
    timezone: string;
    locale: Locale;
    consentedAt: Date | null;
    /** Screen on which consent was last given; `null` when never consented. */
    consentSource: EmailReportConsentSource | null;
    createdAt: Date;
    updatedAt: Date;
}

/** Input for inserting or replacing a user's email-report subscription. */
export interface UpsertEmailReportSubscriptionInput {
    userId: string;
    enabled: boolean;
    daysOfWeek: number;
    sendHour: number;
    timezone: string;
    locale: Locale;
    /** Recorded only on an off-to-on transition, like `consentedAt`. */
    consentSource: EmailReportConsentSource;
}

/** An enabled subscription joined with the recipient's address — the cron's work list. */
export interface EmailReportRecipient {
    userId: string;
    email: string;
    daysOfWeek: number;
    sendHour: number;
    timezone: string;
    locale: Locale;
}

/** Persistence operations for email-report subscriptions. */
export interface EmailReportSubscriptionRepository {
    findByUser(userId: string): Promise<EmailReportSubscriptionRecord | null>;
    upsert(
        input: UpsertEmailReportSubscriptionInput
    ): Promise<EmailReportSubscriptionRecord>;
    /** Enabled subscriptions of verified member-or-above users. */
    findEnabledRecipients(): Promise<EmailReportRecipient[]>;
    /** Turns delivery off; `false` when the user has no subscription row. */
    disable(userId: string): Promise<boolean>;
}

/** Outcome of excluding a symbol from a member's email report. */
export type ExcludeReportSymbolOutcome = 'excluded' | 'limit_reached';

/** Persistence operations for the symbols a member left out of their email report. */
export interface EmailReportExclusionRepository {
    /** Excluded symbols (uppercase) of the user, in no particular order. */
    findExcludedSymbols(userId: string): Promise<string[]>;
    /**
     * Idempotent insert under a per-member lock so concurrent calls cannot exceed `limit`.
     * An already-excluded symbol succeeds regardless of the limit.
     */
    excludeSymbol(
        userId: string,
        symbol: string,
        limit: number
    ): Promise<ExcludeReportSymbolOutcome>;
    /** Puts the symbol back; `false` when it was not excluded. */
    includeSymbol(userId: string, symbol: string): Promise<boolean>;
}

/** Final state of a claimed delivery. */
export type EmailReportDeliveryOutcome = 'sent' | 'failed' | 'skipped';

/** Idempotency log for email-report deliveries (one row per user per local date). */
export interface EmailReportDeliveryRepository {
    /** Claims the (user, localDate) slot; returns the row id, or `null` when already claimed. */
    claim(userId: string, localDate: string): Promise<string | null>;
    finish(
        id: string,
        outcome: EmailReportDeliveryOutcome,
        symbols: readonly string[],
        error: string | null
    ): Promise<void>;
    /** Deletes rows created before `cutoff`; returns the count. */
    pruneOlderThan(cutoff: Date): Promise<number>;
}

/** A persisted mail-alert subscriber — one row per verified address (member or guest). */
export interface MailAlertSubscriberRecord {
    id: string;
    /** Normalized (lower-case, trimmed) address. */
    email: string;
    /** Set when a member with the same verified address exists; `null` for a pure guest. */
    userId: string | null;
    locale: Locale;
    includePortfolio: boolean;
    consentedAt: Date;
    consentSource: MailAlertConsentSourceValue;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Input for creating (or re-confirming) a subscriber after the emailed code was verified. There is
 * deliberately no `userId`: the repository resolves the owner itself (see `upsertVerified`), so a
 * caller cannot link the session user to an address that is not theirs.
 */
export interface UpsertVerifiedMailAlertSubscriberInput {
    /** Already normalized with `normalizeEmail`. */
    email: string;
    locale: Locale;
    consentSource: MailAlertConsentSourceValue;
}

/** One stored topic of a subscriber: `symbol` → upper-case symbol, `signal` → signal type, `fear_greed` → market. */
export interface MailAlertTopicRecord {
    kind: MailAlertTopicKindValue;
    key: string;
}

export type AddMailAlertTopicOutcome =
    | 'added'
    | 'exists'
    | 'limit_reached'
    /** The owner has no subscriber row (deleted between the caller's lookup and this call, or not theirs). */
    | 'subscriber_missing';

export interface RemoveMailAlertTopicOutcome {
    /** The topic existed and was removed. */
    deleted: boolean;
    /** Removing it left the subscriber with nothing to receive (no topics, portfolio off, no live price alert), so the row was deleted too. */
    subscriberDeleted: boolean;
}

/** A subscriber with everything the sender needs — one row per deliverable subscriber. */
export interface MailAlertDeliveryTarget {
    id: string;
    email: string;
    locale: Locale;
    userId: string | null;
    includePortfolio: boolean;
    topics: MailAlertTopicRecord[];
}

/**
 * Who a subscriber-row operation acts for. Every by-id method binds this in the statement (DB-12):
 * a member addresses only the row whose `user_id` is theirs; a guest addresses a row by id **and**
 * only while it is unlinked (`user_id IS NULL`). The guest id comes from the signed
 * `siglens_mail_alert` cookie that app-B issues, never from request input. A member can therefore not
 * reach a guest row by id, a guest id cannot reach a linked row, and one member cannot reach another's.
 */
export type MailAlertOwner =
    | { kind: 'member'; userId: string }
    | { kind: 'guest'; subscriberId: string }
    /**
     * A subscriber named by a signed mail link (`alert-manage` / `alert-unsubscribe`, verified by the
     * caller with the HMAC secret before this value is built). It matches by id only, for guest and
     * member-linked rows alike. The HMAC over the id is the authorization here, not the row state, so
     * this owner must never be built from unsigned input: it is as strong as the secret, exactly like
     * the report unsubscribe link. It is not allowed to change `include_portfolio` (a member setting).
     */
    | { kind: 'link'; subscriberId: string };

/**
 * Persistence operations for mail-alert subscribers and their topics. `upsertVerified` is keyed by the
 * verified address, `findAllForDelivery` is the cron's system-wide read, and `deleteForAccount` /
 * `findForMember` take the authenticated `userId`; every other method takes a {@link MailAlertOwner}.
 */
export interface MailAlertSubscriberRepository {
    /**
     * Creates the subscriber or re-confirms an existing one (unique by email). An existing row keeps
     * its first consent time and screen. `user_id` is resolved in the same statement as the `users` row
     * whose email equals the verified address and is `email_verified`, provided that user has no
     * subscriber row yet; otherwise the row stays a guest (`user_id` null). It is filled only when it
     * was still null.
     */
    upsertVerified(
        input: UpsertVerifiedMailAlertSubscriberInput
    ): Promise<{ id: string; created: boolean }>;
    findByOwner(
        owner: MailAlertOwner
    ): Promise<MailAlertSubscriberRecord | null>;
    /**
     * By `user_id`, else the unlinked row whose address equals the user's own address (read from
     * `users`, and only when `email_verified`), which gets linked. An unverified account adopts nothing.
     */
    findForMember(userId: string): Promise<MailAlertSubscriberRecord | null>;
    listTopics(owner: MailAlertOwner): Promise<MailAlertTopicRecord[]>;
    /** Idempotent insert under a per-subscriber lock so concurrent calls cannot exceed `max`. */
    addTopic(
        owner: MailAlertOwner,
        topic: MailAlertTopicRecord,
        max: number
    ): Promise<AddMailAlertTopicOutcome>;
    /** Removes the topic; deletes the subscriber too when nothing is left to receive. */
    removeTopic(
        owner: MailAlertOwner,
        topic: MailAlertTopicRecord
    ): Promise<RemoveMailAlertTopicOutcome>;
    /**
     * Turning it off with nothing else to receive (no topics, no live price alert) deletes the subscriber. `found` is false when the owner has no
     * row, and always for a guest or link owner (the portfolio is a member's own setting; nothing is
     * written).
     */
    setIncludePortfolio(
        owner: MailAlertOwner,
        value: boolean
    ): Promise<{ found: boolean; subscriberDeleted: boolean }>;
    deleteByOwner(owner: MailAlertOwner): Promise<boolean>;
    /**
     * Links the unlinked subscriber row to a member whose own account address equals the row's address
     * (compared inside the statement), when that member has no row yet. The caller may call it only after
     * the emailed code for that address was verified in the same request; it exists for members whose
     * account email is not `email_verified`, which `upsertVerified` therefore cannot link. Returns whether
     * the row was linked.
     */
    linkVerifiedMember(userId: string, subscriberId: string): Promise<boolean>;
    /**
     * Account deletion: removes the row linked to the user and, when the account's address is verified,
     * the unlinked row with that address. Call it before the `users` row is deleted (the address is read
     * from it).
     */
    deleteForAccount(userId: string): Promise<number>;
    /**
     * Subscribers with at least one topic, the portfolio switch on, or a live price alert. `alertDate`
     * (the sender's KST date) sets the expiry clock; omitted, the DB's KST today.
     */
    findAllForDelivery(alertDate?: string): Promise<MailAlertDeliveryTarget[]>;
}

/** Final state of a claimed mail-alert delivery. */
export type MailAlertDeliveryOutcome = 'sent' | 'failed';

/**
 * A price-alert condition as stored: the same three shapes core's `PriceLevelCondition` has, kept
 * here so `shared/db` does not import core. Prices are JS numbers in this layer; the column is
 * `numeric(20,6)`, so a value is exact to six decimals.
 */
export type PriceAlertConditionRecord =
    | {
          kind: 'enter_zone';
          low: number;
          high: number;
          approach: PriceAlertApproachValue;
      }
    | { kind: 'close_below'; level: number }
    | { kind: 'close_above'; level: number };

/** A persisted price alert. */
export interface PriceAlertRecord {
    id: string;
    subscriberId: string;
    proposalId: string;
    symbol: string;
    market: PriceAlertMarketValue;
    condition: PriceAlertConditionRecord;
    basis: PriceAlertBasisValue;
    /** `analyzedAt` of the AI analysis the levels came from; `null` for a price the user named. */
    analysisAt: Date | null;
    /** The price shown on the card when the alert was proposed. */
    referenceClose: number;
    /** KST `YYYY-MM-DD` of the last closed session at creation: only later closes count. */
    startsAfterSession: string;
    /** KST `YYYY-MM-DD`; the alert is still live on this date. */
    expiresOn: string;
    status: PriceAlertStatusValue;
    firedSession: string | null;
    firedClose: number | null;
    firedAt: Date | null;
    createdAt: Date;
}

/** What the create action hands over after verifying the signed proposal. */
export interface CreatePriceAlertInput {
    /** From the signed proposal: makes a repeated create of the same proposal idempotent. */
    proposalId: string;
    symbol: string;
    market: PriceAlertMarketValue;
    condition: PriceAlertConditionRecord;
    basis: PriceAlertBasisValue;
    analysisAt: Date | null;
    referenceClose: number;
    startsAfterSession: string;
    expiresOn: string;
}

export type CreatePriceAlertOutcome =
    | 'created'
    /** The same proposal was already created (a retry or a double click). */
    | 'exists'
    /** A live alert with the same symbol, condition and levels already exists. */
    | 'duplicate'
    | 'limit_reached'
    /** The owner has no subscriber row (unsubscribed between the caller's lookup and this call, or not theirs). */
    | 'subscriber_missing'
    /** A price is not a finite positive number, or a zone has low above high. Nothing was written. */
    | 'invalid';

export interface CancelPriceAlertOutcome {
    /** The alert existed, was the owner's, and was removed. */
    deleted: boolean;
    /** Removing it left the subscriber with nothing to receive, so the row was deleted too. */
    subscriberDeleted: boolean;
}

export interface PruneExpiredPriceAlertsResult {
    alertsDeleted: number;
    /** Subscribers that lost an alert in this run and were left with nothing to receive. */
    subscribersDeleted: number;
}

/**
 * Persistence operations for price alerts. Every user-reachable method takes a {@link MailAlertOwner}
 * and resolves the subscriber inside the statement (DB-12): another owner's subscriber, or an alert id
 * that is not theirs, matches nothing. `listActiveForDelivery` and `pruneExpiredAndFired` are
 * cron-only and system-wide.
 */
export interface PriceAlertRepository {
    /**
     * Under a `FOR NO KEY UPDATE` lock on the owner's subscriber row: `invalid` for a non-finite or
     * non-positive price, `exists` for a repeated proposal id, `duplicate` for a live alert with the
     * same symbol, condition and levels, `limit_reached` when the live count is already `max`, else
     * inserts. Safe under `withRetry`.
     */
    createWithinLimit(
        owner: MailAlertOwner,
        input: CreatePriceAlertInput,
        max: number
    ): Promise<CreatePriceAlertOutcome>;
    /**
     * Deletes the owner's own alert; deletes the subscriber too when nothing is left to receive (no
     * topics, portfolio switch off, no live alert). Another owner's alert id is a no-op.
     */
    cancel(owner: MailAlertOwner, id: string): Promise<CancelPriceAlertOutcome>;
    /** Every alert of the owner's subscriber (live, expired-unpruned and fired), oldest first. */
    listForSubscriber(owner: MailAlertOwner): Promise<PriceAlertRecord[]>;
    findByProposal(
        owner: MailAlertOwner,
        proposalId: string
    ): Promise<PriceAlertRecord | null>;
    /** Live alerts: `status = 'active'` and not past its KST expiry date. */
    countActive(owner: MailAlertOwner): Promise<number>;
    /** Active alerts with `expires_on >= alertDate`, grouped by subscriber, oldest first. */
    listActiveForDelivery(
        alertDate: string
    ): Promise<Map<string, PriceAlertRecord[]>>;
    /**
     * Deletes active alerts with `expires_on < alertDate` and fired alerts fired more than
     * `PRICE_ALERT_FIRED_RETENTION_DAYS` KST days before `alertDate`, then the subscribers that lost an
     * alert here and have nothing left to receive (same rule as `removeTopic`).
     */
    pruneExpiredAndFired(
        alertDate: string
    ): Promise<PruneExpiredPriceAlertsResult>;
}

/**
 * Idempotency log for mail-alert deliveries (one row per subscriber per KST alert date). Cron-only:
 * these methods are keyed by ids the sender just read or claimed itself and are never reachable from a
 * user request, so they take no {@link MailAlertOwner}.
 */
export interface MailAlertDeliveryRepository {
    /** Claims the (subscriber, alertDate) slot; returns the row id, or `null` when already claimed. */
    claim(subscriberId: string, alertDate: string): Promise<string | null>;
    finish(
        id: string,
        outcome: MailAlertDeliveryOutcome,
        itemKeys: readonly string[],
        error: string | null
    ): Promise<void>;
    /** Item keys of `sent` deliveries with `alert_date >= sinceAlertDate`, per subscriber. */
    recentItemKeys(sinceAlertDate: string): Promise<Map<string, Set<string>>>;
    /** Deletes deliveries whose `alert_date` is before `alertDate`; returns the count. */
    pruneBefore(alertDate: string): Promise<number>;
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
        entries: readonly KoreanTickerUpsertEntry[],
        options?: KoreanTickerUpsertOptions
    ): Promise<void>;
    /** Every row's symbol and listing status — the reconcile planner's input. */
    findAllListingStatuses(): Promise<KrTickerListingRow[]>;
    /**
     * 국내(`.KS`/`.KQ`) 외 모든 행 — 이름 재대조(`reconcileUsTickerNames`)의 입력.
     * 국내 이름은 KRX cron이 정본이라 여기서 제외한다.
     */
    findAllNonKr(): Promise<KoreanTickerEntry[]>;
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
    /** 전 행 — 이름 재대조(`reconcileUsTickerNames`)의 입력. */
    findAll(): Promise<AssetTranslationRecord[]>;
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
    /** 심볼의 회사 설명 번역을 지운다 — 회사가 바뀐 심볼은 다음 조회가 다시 번역한다. */
    deleteBySymbols(symbols: readonly string[]): Promise<void>;
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
    /**
     * Case-insensitive substring match over symbol, name and koreanName. `%`·`_` in
     * `query` match literally. Exact matches rank first, then prefix matches, then
     * the rest by circulatingSupply desc; capped at `limit`.
     */
    search(query: string, limit: number): Promise<CryptoAssetRecord[]>;
}

/**
 * Persistence operations backing the `analysis_plain_texts` table. The
 * `(promptVersion, locale, inputDigest)` triple is the composite primary key;
 * `inputDigest` is the sha256 hex of the full prompt (content-addressed).
 */
export interface PlainTextRepository {
    /** 저장된 평이화 텍스트. 없으면 `null`. */
    find(
        promptVersion: string,
        locale: string,
        inputDigest: string
    ): Promise<string | null>;
    /**
     * 평이화 텍스트를 저장한다. 키가 같으면(동시 생성 레이스 포함) 기존 행을 그대로
     * 둔다 — 내용 주소 키라 어느 쪽이든 유효하다.
     */
    insert(
        promptVersion: string,
        locale: string,
        inputDigest: string,
        text: string
    ): Promise<void>;
}
