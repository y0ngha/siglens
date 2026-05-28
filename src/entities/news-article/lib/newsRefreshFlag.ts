import 'server-only';
import { Redis } from '@upstash/redis';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

/** 뉴스 refresh 플래그 TTL — 이 시간 내 재크롤링(봇)은 FMP fetch+upsert를 스킵. */
export const NEWS_REFRESH_FLAG_TTL_SECONDS = 10 * SECONDS_PER_MINUTE;

let cachedRedis: Redis | null | undefined;
function getRedis(): Redis | null {
    if (cachedRedis !== undefined) return cachedRedis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        cachedRedis = null;
        return null;
    }
    cachedRedis = new Redis({ url, token });
    return cachedRedis;
}

function buildKey(symbol: string): string {
    return `news:refresh:${symbol.toUpperCase()}`;
}

/** 최근(TTL 내) 이 symbol의 뉴스를 fetch했는지. Redis 미설정/장애 시 false(=항상 fetch). */
export async function isRecentlyFetched(symbol: string): Promise<boolean> {
    const redis = getRedis();
    if (redis === null) return false;
    try {
        return (await redis.get(buildKey(symbol))) !== null;
    } catch (error) {
        console.error('[newsRefreshFlag] get failed', error);
        return false;
    }
}

/** 이 symbol을 "최근 fetch함"으로 표시. Redis 미설정/장애 시 noop. */
export async function markFetched(symbol: string): Promise<void> {
    const redis = getRedis();
    if (redis === null) return;
    try {
        await redis.set(buildKey(symbol), '1', {
            ex: NEWS_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[newsRefreshFlag] set failed', error);
    }
}
