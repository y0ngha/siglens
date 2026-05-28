import crypto from 'crypto';
import type { Redis } from '@upstash/redis';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';
import type { SupportedOAuthProvider } from '@/shared/lib/types';

const NAMESPACE = 'pending_oauth_signup';
const TTL_SECONDS = 10 * SECONDS_PER_MINUTE;

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

function tryParse(value: unknown): PendingOAuthSignup | null {
    if (value === null || value === undefined) return null;
    // Upstash Redis auto-deserializes stored JSON, so value may already be an object.
    // Safe cast: we only store PendingOAuthSignup via save(), and Upstash preserves the shape on deserialization.
    if (typeof value === 'object') return value as PendingOAuthSignup;
    if (typeof value !== 'string') return null;
    try {
        // Safe cast: the serialized value was produced by JSON.stringify on a PendingOAuthSignup in save().
        return JSON.parse(value) as PendingOAuthSignup;
    } catch {
        return null;
    }
}

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

/** Factory that reads Redis env vars and returns a store, or null if unavailable. */
export function createPendingOAuthSignupStoreFromEnv(): PendingOAuthSignupStore | null {
    const client = getRedisClient();
    if (client === null) return null;
    return createPendingOAuthSignupStore(client);
}
