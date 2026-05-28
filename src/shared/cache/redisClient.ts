import 'server-only';
import { Redis } from '@upstash/redis';

export interface RedisClientPair {
    writer: Redis;
    reader: Redis;
}

interface UpstashEnv {
    url: string;
    token: string;
    /** Read-only token; null when the env var is unset or empty (no separate reader created). */
    readonlyToken: string | null;
}

// undefined = not yet initialized; null = env not configured (graceful fallback).
let cachedWriter: Redis | null | undefined;
let cachedEnv: UpstashEnv | null | undefined;
// No null state: once initialized, reader is always a Redis instance
// (either the writer itself or a dedicated readonly client).
let cachedReader: Redis | undefined;

function getUpstashEnv(): UpstashEnv | null {
    if (cachedEnv === undefined) cachedEnv = readUpstashEnv();
    return cachedEnv;
}

function readUpstashEnv(): UpstashEnv | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    // Treat empty string as "unset" so a literal empty env var doesn't create a reader.
    const raw = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    const readonlyToken = raw === undefined || raw === '' ? null : raw;
    return { url, token, readonlyToken };
}

/**
 * The app's shared Upstash Redis writer client (singleton).
 *
 * Returns `null` when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are
 * not set, so callers can degrade gracefully (cache miss / direct fetch) in
 * environments without Redis (local dev, tests).
 */
export function getRedisClient(): Redis | null {
    if (cachedWriter !== undefined) return cachedWriter;
    const env = getUpstashEnv();
    cachedWriter = env ? new Redis({ url: env.url, token: env.token }) : null;
    return cachedWriter;
}

/**
 * Writer + reader pair (singleton). When `UPSTASH_REDIS_REST_READONLY_TOKEN` is
 * set, `reader` uses the read-only token; otherwise `reader === writer`. The
 * `writer` is the same instance returned by {@link getRedisClient}. Returns
 * `null` when Redis env is not configured.
 */
export function getRedisReaderWriter(): RedisClientPair | null {
    const writer = getRedisClient();
    if (writer === null) return null;
    if (cachedReader === undefined) {
        // writer is non-null here, so getUpstashEnv() is also non-null.
        const env = getUpstashEnv()!;
        cachedReader =
            env.readonlyToken !== null
                ? new Redis({ url: env.url, token: env.readonlyToken })
                : writer;
    }
    return { writer, reader: cachedReader };
}

/** Reset the cached singletons between test runs. */
export function __resetRedisClientForTests(): void {
    cachedWriter = undefined;
    cachedReader = undefined;
    cachedEnv = undefined;
}
