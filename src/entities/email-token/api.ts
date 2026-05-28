import { getRedisReaderWriter } from '@/shared/cache/redisClient';

/** Purpose tag namespacing email-token Redis keys so password-reset and email-verification tokens for the same email never collide. */
export type EmailTokenPurpose = 'password_reset' | 'email_verification';

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

const KEY_PREFIX = 'email_token';

/** Build the Redis key for an email-token entry. */
export function buildEmailTokenKey(
    purpose: EmailTokenPurpose,
    email: string
): string {
    return `${KEY_PREFIX}:${purpose}:${email}`;
}

/** Upstash Redis 기반 EmailTokenStore 생성 — 환경변수 부재 시 null (caller가 graceful degrade 결정). */
export function createEmailTokenStore(): EmailTokenStore | null {
    const pair = getRedisReaderWriter();
    if (pair === null) return null;
    const { writer, reader } = pair;

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
