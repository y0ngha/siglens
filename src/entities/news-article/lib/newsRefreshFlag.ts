import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

const NEWS_REFRESH_FLAG_TTL_MINUTES = 10;

/** 뉴스 refresh 플래그 TTL — 이 시간 내 재크롤링(봇)은 FMP fetch+upsert를 스킵. */
export const NEWS_REFRESH_FLAG_TTL_SECONDS =
    NEWS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

function buildKey(symbol: string): string {
    return `news:refresh:${symbol.toUpperCase()}`;
}

/** 최근(TTL 내) 이 symbol의 뉴스를 fetch했는지. Redis 미설정/장애 시 false(=항상 fetch). */
export async function isRecentlyFetched(symbol: string): Promise<boolean> {
    const redis = getRedisClient();
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
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(buildKey(symbol), '1', {
            ex: NEWS_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[newsRefreshFlag] set failed', error);
    }
}
