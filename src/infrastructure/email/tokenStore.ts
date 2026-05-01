import { Redis } from '@upstash/redis';

/**
 * Purpose tag used to namespace email-token Redis keys so that a password
 * reset token never collides with an email-verification token for the same
 * email address.
 */
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

/**
 * Persisted Redis value for an email token.
 *
 * - `pending` — token has been issued but not yet verified. The hashed token is
 *   stored so that the verification step can compare a freshly hashed user
 *   input against {@link tokenHash} in constant time.
 * - `verified` — only used by the email-verification flow. Once the user has
 *   confirmed their code, the value is replaced with a `verified` marker so
 *   that a later registration call can confirm the email is owned without
 *   asking for the code again.
 */
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
    readonlyToken: string;
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
    return {
        url,
        token,
        readonlyToken: process.env.UPSTASH_REDIS_REST_READONLY_TOKEN ?? '',
    };
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
    const configKey = `${config.url}:${config.token}:${config.readonlyToken}`;
    if (cachedRedisPair !== null && cachedConfigKey === configKey) {
        return cachedRedisPair;
    }

    const writer = new Redis({ url: config.url, token: config.token });
    const reader = config.readonlyToken
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
    };
}
