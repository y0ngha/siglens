import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    CALENDAR_ANALYSIS_REFRESH_FLAG_KEY,
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/economyCalendarConstants';

/** 최근 TTL 내 분석 pass 수행 여부 — Redis 실패 시 false(항상 스캔). SP-A 플래그 미러. */
export async function isAnalysisRecentlyRun(): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(CALENDAR_ANALYSIS_REFRESH_FLAG_KEY)) !== null;
    } catch (error) {
        console.error('[calendarAnalysisRefreshFlag] get failed', error);
        return false;
    }
}

/** "최근 분석함" 마킹 — Redis 실패 시 noop. */
export async function markAnalysisRun(): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(CALENDAR_ANALYSIS_REFRESH_FLAG_KEY, '1', {
            ex: CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[calendarAnalysisRefreshFlag] set failed', error);
    }
}
