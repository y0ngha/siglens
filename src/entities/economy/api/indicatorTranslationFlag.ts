import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    INDICATOR_TRANSLATION_FLAG_PREFIX,
    INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
} from '../lib/indicatorTranslationConstants';

function flagKey(normalizedName: string): string {
    return `${INDICATOR_TRANSLATION_FLAG_PREFIX}:${normalizedName}`;
}

/**
 * 해당 지표명의 AI 번역이 최근 TTL 내에 제출됐는지 — Redis 실패/미구성 시 false
 * (항상 제출 시도). market-news `isRecentlyFetched` 미러.
 */
export async function isIndicatorTranslationPending(
    normalizedName: string
): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(flagKey(normalizedName))) !== null;
    } catch (error) {
        console.error('[indicatorTranslationFlag] get failed', error);
        return false;
    }
}

/** "이 지표명 번역 제출함" 마킹 — Redis 실패 시 noop. */
export async function markIndicatorTranslationPending(
    normalizedName: string
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(flagKey(normalizedName), '1', {
            ex: INDICATOR_TRANSLATION_FLAG_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[indicatorTranslationFlag] set failed', error);
    }
}
