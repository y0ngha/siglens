import crypto from 'crypto';
import type { Redis } from '@upstash/redis';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';
import type { SupportedOAuthProvider } from '@/shared/lib/types';

const NAMESPACE = 'pending_oauth_signup';
const TTL_SECONDS = 10 * SECONDS_PER_MINUTE;

/** OAuth 콜백 후 약관 동의 전까지 Redis에 임시 보관하는 가입 프로필(TTL 10분). 소비자: 콜백 route, 동의 페이지·액션. */
export interface PendingOAuthSignup {
    provider: SupportedOAuthProvider;
    email: string;
    providerAccountId: string;
    name?: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
    next: string;
    createdAt: string;
}

/** 가입 프로필 저장소. `consume`은 원자적 getdel이라 같은 토큰으로 한 번만 가입이 완료된다. */
export interface PendingOAuthSignupStore {
    save(profile: PendingOAuthSignup): Promise<string>;
    peek(token: string): Promise<PendingOAuthSignup | null>;
    consume(token: string): Promise<PendingOAuthSignup | null>;
    delete(token: string): Promise<void>;
}

function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

function buildKey(token: string): string {
    return `${NAMESPACE}:${token}`;
}

function isOptionalString(value: unknown): boolean {
    return value === undefined || typeof value === 'string';
}

/** 저장소에서 읽은 값이 {@link PendingOAuthSignup} 형태인지 검증한다(손상·변조된 값 거부). */
function isPendingOAuthSignup(value: unknown): value is PendingOAuthSignup {
    if (typeof value !== 'object' || value === null) return false;
    const record: Record<string, unknown> = { ...value };
    return (
        record.provider === 'google' &&
        typeof record.email === 'string' &&
        typeof record.providerAccountId === 'string' &&
        typeof record.accessToken === 'string' &&
        typeof record.next === 'string' &&
        typeof record.createdAt === 'string' &&
        isOptionalString(record.name) &&
        isOptionalString(record.avatarUrl) &&
        isOptionalString(record.refreshToken) &&
        isOptionalString(record.tokenExpiresAt)
    );
}

function parseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * Upstash는 저장된 JSON을 자동 역직렬화하므로 값이 객체일 수도 문자열일 수도 있다.
 * 형태 검증을 통과하지 못하면 null — 호출자는 만료/없음과 동일하게 취급한다.
 */
function tryParse(value: unknown): PendingOAuthSignup | null {
    const candidate = typeof value === 'string' ? parseJson(value) : value;
    return isPendingOAuthSignup(candidate) ? candidate : null;
}

/** 주입한 Redis 클라이언트로 {@link PendingOAuthSignupStore}를 만든다. 토큰은 32바이트 난수 hex. */
export function createPendingOAuthSignupStore(
    client: Redis
): PendingOAuthSignupStore {
    return {
        async save(profile: PendingOAuthSignup): Promise<string> {
            const token = generateToken();
            await client.set(buildKey(token), JSON.stringify(profile), {
                ex: TTL_SECONDS,
            });
            return token;
        },
        async peek(token: string): Promise<PendingOAuthSignup | null> {
            const raw = await client.get(buildKey(token));
            return tryParse(raw);
        },
        async consume(token: string): Promise<PendingOAuthSignup | null> {
            const raw = await client.getdel(buildKey(token));
            return tryParse(raw);
        },
        async delete(token: string): Promise<void> {
            await client.del(buildKey(token));
        },
    };
}

/** 환경변수 기반 Redis 클라이언트로 저장소를 만든다. Redis 미설정이면 null. */
export function createPendingOAuthSignupStoreFromEnv(): PendingOAuthSignupStore | null {
    const client = getRedisClient();
    if (client === null) return null;
    return createPendingOAuthSignupStore(client);
}
