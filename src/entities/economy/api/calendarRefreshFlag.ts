import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    CALENDAR_REFRESH_FLAG_KEY,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/economyCalendarConstants';

/** 최근 TTL 내 fetch 여부 — Redis 실패 시 false(항상 fetch). market-news 미러. */
export async function isCalendarRecentlyFetched(): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(CALENDAR_REFRESH_FLAG_KEY)) !== null;
    } catch (error) {
        console.error('[calendarRefreshFlag] get failed', error);
        return false;
    }
}

/** "최근 fetch함" 마킹 — Redis 실패 시 noop. */
export async function markCalendarFetched(): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(CALENDAR_REFRESH_FLAG_KEY, '1', {
            ex: CALENDAR_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[calendarRefreshFlag] set failed', error);
    }
}
