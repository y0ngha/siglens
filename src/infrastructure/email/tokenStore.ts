import { Redis } from '@upstash/redis';

/** Purpose tag namespacing email-token Redis keys so password-reset and email-verification tokens for the same email never collide. */
export type EmailTokenPurpose = 'password_reset' | 'email_verification';

/** Email message payload passed to an {@link EmailDispatcher} implementation. */
export interface EmailMessage {
    /** Recipient email address. */
    to: string;
    /** Email subject line. */
    subject: string;
    /** HTML body of the email. */
    html: string;
    /** Plain-text body of the email. */
    text: string;
}

/** Persisted Redis value for an email token: 'pending' (token issued; tokenHash stored for constant-time compare on verify) or 'verified' (email-verification flow only; marker so later registration confirms ownership without re-prompting the code). */
export type EmailTokenValue =
    | { status: 'pending'; tokenHash: string }
    | { status: 'verified' };

/**
 * Redis-backed key-value store for email-token state. Keys are derived from
 * `(purpose, email)` pairs by the implementation; callers never see raw keys.
 */
export interface EmailTokenStore {
    /**
     * Persist {@link value} under `(purpose, email)` with the given TTL.
     * Overwrites any existing value for the same pair.
     */
    set(
        purpose: EmailTokenPurpose,
        email: string,
        value: EmailTokenValue,
        ttlSeconds: number
    ): Promise<void>;

    /**
     * Read the persisted value for `(purpose, email)`, or `null` when no entry
     * exists or the entry has expired.
     */
    get(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;

    /** Delete the entry for `(purpose, email)`. No-op when no entry exists. */
    delete(purpose: EmailTokenPurpose, email: string): Promise<void>;

    /**
     * Atomically read and delete the entry for `(purpose, email)`. Returns the
     * pre-deletion value when the entry existed, or `null` when no entry was
     * present. Implementations MUST guarantee that at most one concurrent caller
     * receives a non-null result for the same `(purpose, email)` pair so that
     * single-use tokens (password reset, etc.) cannot be replayed within a
     * concurrency race.
     */
    consume(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;
}

/**
 * Abstraction for delivering transactional emails.
 *
 * Consumers inject their own implementation (Resend, SendGrid, SMTP, etc.)
 * into use-cases that need to dispatch email.
 */
export interface EmailDispatcher {
    /**
     * Send a transactional email message.
     *
     * @returns `true` when accepted for delivery, `false` otherwise.
     */
    sendEmail(message: EmailMessage): Promise<boolean>;
}

const KEY_PREFIX = 'email_token';

interface UpstashConfig {
    url: string;
    token: string;
    /** Optional read-only token; null when the env var is unset (no separate reader is created in that case). */
    readonlyToken: string | null;
}

interface RedisPair {
    writer: Redis;
    reader: Redis;
}

let cachedRedisPair: RedisPair | null = null;
let cachedConfigKey: string | null = null;

function readUpstashConfig(): UpstashConfig | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    // Treat empty string as "unset" so a literal empty env var doesn't collide
    // with a real readonly token in the cache key below.
    const rawReadonly = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    const readonlyToken =
        rawReadonly === undefined || rawReadonly === '' ? null : rawReadonly;
    return { url, token, readonlyToken };
}

/** @internal Test-only reset of the cached Redis client pair. */
export function __resetEmailTokenStoreCacheForTests(): void {
    cachedRedisPair = null;
    cachedConfigKey = null;
}

/** @internal Build the Redis key for an email-token entry. */
export function buildEmailTokenKey(
    purpose: EmailTokenPurpose,
    email: string
): string {
    return `${KEY_PREFIX}:${purpose}:${email}`;
}

function getRedisPair(config: UpstashConfig): RedisPair {
    // Encode "no readonly token" distinctly from "configured empty string" so a
    // future change in env handling can never collide identities. The 2-segment
    // form is reserved for the unset case; the 3-segment form for configured.
    const configKey =
        config.readonlyToken === null
            ? `${config.url}:${config.token}`
            : `${config.url}:${config.token}:${config.readonlyToken}`;
    if (cachedRedisPair !== null && cachedConfigKey === configKey) {
        return cachedRedisPair;
    }

    const writer = new Redis({ url: config.url, token: config.token });
    const reader =
        config.readonlyToken !== null
            ? new Redis({ url: config.url, token: config.readonlyToken })
            : writer;
    cachedRedisPair = { writer, reader };
    cachedConfigKey = configKey;
    return cachedRedisPair;
}

/**
 * Construct an {@link EmailTokenStore} backed by Upstash Redis.
 *
 * Returns `null` when the required env vars are not present so callers can
 * decide how to degrade.
 */
export function createEmailTokenStore(): EmailTokenStore | null {
    const config = readUpstashConfig();
    if (!config) return null;

    const { writer, reader } = getRedisPair(config);

    return {
        async set(purpose, email, value, ttlSeconds) {
            await writer.set(buildEmailTokenKey(purpose, email), value, {
                ex: ttlSeconds,
            });
        },
        async get(purpose, email) {
            return reader.get<EmailTokenValue>(
                buildEmailTokenKey(purpose, email)
            );
        },
        async delete(purpose, email) {
            await writer.del(buildEmailTokenKey(purpose, email));
        },
        async consume(purpose, email) {
            // Upstash Redis exposes GETDEL which atomically returns the value
            // and deletes the key in a single round-trip. This is the primitive
            // that prevents two concurrent password-reset confirmations from
            // both observing the same pending token.
            const key = buildEmailTokenKey(purpose, email);
            const value = await writer.getdel<EmailTokenValue>(key);
            return value ?? null;
        },
    };
}
