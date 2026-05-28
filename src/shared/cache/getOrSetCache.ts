import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';

interface CacheEnvelope<T> {
    data: T;
}

/**
 * Read-through Redis 캐시 헬퍼. `barsDataCache`/`marketSummaryCache`의 인라인
 * get→fetch→set 패턴을 일반화한 것으로, 여러 호출부의 보일러플레이트를 줄인다.
 *
 * 값은 `{ data: T }` envelope으로 감싸 저장한다. Upstash `get`은 cache miss와
 * 저장된 `null`을 모두 `null`로 돌려주는데, envelope이 있으면 miss는 `null`,
 * hit은 `{ data: ... }`(안의 값이 `null`이어도)로 구분된다. 덕분에 "데이터 없음"을
 * 뜻하는 정상 `null`(예: 프로필 없는 티커)도 캐싱해, 롱테일/봇 트래픽이 매 요청마다
 * FMP를 재호출하던 문제를 막는다.
 *
 * 일시 장애는 캐싱되지 않는다 — 호출부 fetcher(fmpGet 기반)가 실패 시 throw하므로
 * 잘못된 값이 set 단계에 도달하지 못한다.
 *
 * Redis 미설정/장애 시에는 graceful fallback — `fetcher()`를 직접 호출한다.
 */
export async function getOrSetCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const redis = getRedisClient();
    if (redis !== null) {
        try {
            const hit = await redis.get<CacheEnvelope<T>>(key);
            if (hit !== null) return hit.data;
        } catch (error) {
            console.error(`[getOrSetCache] get failed: ${key}`, error);
        }
    }

    const fresh = await fetcher();

    if (redis !== null) {
        try {
            await redis.set(key, { data: fresh }, { ex: ttlSeconds });
        } catch (error) {
            console.error(`[getOrSetCache] set failed: ${key}`, error);
        }
    }
    return fresh;
}
