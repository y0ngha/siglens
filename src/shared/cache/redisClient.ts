import 'server-only';
import { Redis } from '@upstash/redis';
import {
    isOfflineBuild,
    warnOfflineBuildOnce,
    OFFLINE_BUILD_SERVICE,
} from '@/shared/api/offlineBuild';

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
    // offline build 중엔 env가 실제로 설정돼 있어도(로컬 .env.local이 프로덕션
    // 자격증명을 담고 있으므로) 미설정인 것처럼 취급한다 — 이 결과가 cachedEnv로
    // 메모되므로 이 체크는 메모이제이션보다 먼저 실행돼야 한다.
    if (isOfflineBuild()) {
        warnOfflineBuildOnce(OFFLINE_BUILD_SERVICE.UPSTASH);
        return null;
    }
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    // Treat empty string as "unset" so a literal empty env var doesn't create a reader.
    const raw = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    const readonlyToken = raw === undefined || raw === '' ? null : raw;
    return { url, token, readonlyToken };
}

/**
 * Writer 자격증명(URL + 쓰기 토큰). 미설정·오프라인 빌드면 `null`.
 *
 * `@upstash/redis` 패키지는 전역 `fetch`로 요청하므로 정적(ISR) 렌더 안에서 쓰면 그
 * 렌더를 동적으로 바꾼다. 렌더 중 쓰기가 필요한 곳은 이 자격증명으로
 * {@link import('./upstashRenderSafeCommand').runUpstashCommandOutsideFetch}를 쓴다.
 */
export function getUpstashWriterCredentials(): {
    url: string;
    token: string;
} | null {
    const env = getUpstashEnv();
    return env ? { url: env.url, token: env.token } : null;
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
