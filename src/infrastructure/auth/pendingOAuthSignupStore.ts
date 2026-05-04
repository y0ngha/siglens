import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import type { SupportedOAuthProvider } from '@/domain/types';

const NAMESPACE = 'pending_oauth_signup';
const TTL_SECONDS = 600;

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

function tryParse(value: string | null): PendingOAuthSignup | null {
    if (value === null) return null;
    try {
        // This value was serialized by save() via JSON.stringify(PendingOAuthSignup),
        // so the shape is guaranteed as long as the key's TTL hasn't been corrupted externally.
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
            // Safe: client.get() returns the value written by save() via JSON.stringify(PendingOAuthSignup).
            const raw = (await client.get(buildKey(token))) as string | null;
            return tryParse(raw);
        },
        async consume(token: string): Promise<PendingOAuthSignup | null> {
            // Safe: client.getdel() atomically returns the value written by save() via JSON.stringify(PendingOAuthSignup) and deletes the key.
            const raw = (await client.getdel(buildKey(token))) as string | null;
            return tryParse(raw);
        },
        async delete(token: string): Promise<void> {
            await client.del(buildKey(token));
        },
    };
}

/** Factory that reads Redis env vars and returns a store, or null if unavailable. */
export function createPendingOAuthSignupStoreFromEnv(): PendingOAuthSignupStore | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    const client = new Redis({ url, token });
    return createPendingOAuthSignupStore(client);
}
