import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';

/**
 * Read-through Redis 캐시 헬퍼. `barsDataCache`/`marketSummaryCache`의 인라인
 * get→fetch→set 패턴을 일반화한 것으로, 여러 호출부의 보일러플레이트를 줄인다.
 *
 * 1. Redis 미설정/장애 시 graceful fallback — `fetcher()`를 직접 호출한다.
 * 2. `shouldCache(value)`가 false면 결과를 저장하지 않는다 — transient 실패
 *    (예: FMP 장애로 인한 null)를 TTL 동안 굳히지 않기 위함. 기본값은 항상 캐시.
 *
 * 주의: Upstash `get`은 cache miss와 저장된 `null`을 구분하지 못한다. 따라서
 * `null`을 캐시하지 않는 호출부(`shouldCache: v => v !== null`)에서만
 * "get이 null이면 miss"라는 불변식이 성립한다.
 */
export async function getOrSetCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true
): Promise<T> {
    const redis = getRedisClient();
    if (redis !== null) {
        try {
            const hit = await redis.get<T>(key);
            if (hit !== null) return hit;
        } catch (error) {
            console.error(`[getOrSetCache] get failed: ${key}`, error);
        }
    }

    const fresh = await fetcher();

    if (redis !== null && shouldCache(fresh)) {
        try {
            await redis.set(key, fresh, { ex: ttlSeconds });
        } catch (error) {
            console.error(`[getOrSetCache] set failed: ${key}`, error);
        }
    }
    return fresh;
}
