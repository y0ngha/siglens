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

/** Redis 기반 email-token KV store; 키는 구현체가 (purpose, email)에서 파생. */
export interface EmailTokenStore {
    /** (purpose, email)에 value를 TTL과 함께 저장 (덮어쓰기). */
    set(
        purpose: EmailTokenPurpose,
        email: string,
        value: EmailTokenValue,
        ttlSeconds: number
    ): Promise<void>;

    /** (purpose, email) 값을 읽거나, 없거나 만료 시 null. */
    get(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;

    /** (purpose, email) 항목 삭제 — 없으면 no-op. */
    delete(purpose: EmailTokenPurpose, email: string): Promise<void>;

    // 단일 사용 토큰(비밀번호 재설정 등) 재사용 방지를 위해 동시 caller 중 단 하나만
    // non-null을 받도록 atomic read+delete 보장 필수.
    /** (purpose, email)을 atomic하게 읽고 삭제 — 사전 값 또는 null 반환. */
    consume(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;
}

/** 트랜잭셔널 이메일 발송 추상 (Resend/SendGrid/SMTP 등을 use-case에 주입). */
export interface EmailDispatcher {
    /** 메시지 발송 — 전송 수락 시 true, 거절 시 false. */
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

/** Upstash Redis 기반 EmailTokenStore 생성 — 환경변수 부재 시 null (caller가 graceful degrade 결정). */
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
