import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

const MARKET_NEWS_REFRESH_FLAG_TTL_MINUTES = 10;

/**
 * Market-news refresh flag TTL — bots that re-crawl within this window skip
 * the FMP fetch+upsert to avoid unnecessary API calls. Mirrors `newsRefreshFlag`
 * in `news-article` but keyed by sentinel symbol to keep slice isolation.
 */
export const MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS =
    MARKET_NEWS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

function buildKey(sentinel: string): string {
    return `market-news:refresh:${sentinel}`;
}

/** Returns true if this sentinel bucket was fetched within the TTL. Redis failure → false (always fetch). */
export async function isRecentlyFetched(sentinel: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(buildKey(sentinel))) !== null;
    } catch (error) {
        console.error('[marketNewsRefreshFlag] get failed', error);
        return false;
    }
}

/** Mark this sentinel bucket as "recently fetched". Redis failure → noop. */
export async function markFetched(sentinel: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(buildKey(sentinel), '1', {
            ex: MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[marketNewsRefreshFlag] set failed', error);
    }
}
