import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';

interface CacheEnvelope<T> {
    data: T;
}

/**
 * envelope 포맷인지 검증 — 레거시 raw 엔트리(`.data` 없음)를 가려내기 위함.
 *
 * 제약: `'data' in value`만 확인하므로 최상위에 `data` 키를 가진 임의 객체는
 * envelope으로 간주된다. 현재는 모든 쓰기가 이 헬퍼를 거쳐 항상 `{ data }`로
 * 이중 래핑하므로 안전하지만, 향후 자체적으로 `data` 필드를 갖는 도메인 객체를
 * raw로 저장하는 호출부가 생기면 오인될 수 있다 — 그 경우 envelope에 brand/version
 * 필드를 추가해 포맷을 명확히 할 것.
 */
function isCacheEnvelope<T>(value: unknown): value is CacheEnvelope<T> {
    return typeof value === 'object' && value !== null && 'data' in value;
}

/**
 * Read-through Redis 캐시 헬퍼. get→fetch→set 패턴을 일반화해 호출부의
 * 보일러플레이트를 줄인다.
 *
 * 값은 `{ data: T }` envelope으로 감싸 저장한다. Upstash `get`은 cache miss와
 * 저장된 `null`을 모두 `null`로 돌려주는데, envelope이 있으면 miss는 `null`,
 * hit은 `{ data: ... }`(안의 값이 `null`이어도)로 구분된다. 덕분에 "데이터 없음"을
 * 뜻하는 정상 `null`(예: 프로필 없는 티커)도 캐싱해, 롱테일/봇 트래픽이 매 요청마다
 * FMP를 재호출하던 문제를 막는다.
 *
 * envelope이 아닌 레거시 raw 엔트리(이전 포맷이 운영 Redis에 남아 있는 경우)는 cache
 * miss로 취급한다 — 그대로 반환하면 `hit.data`가 `undefined`가 되므로, fetch 후
 * envelope으로 덮어써 자가 마이그레이션한다.
 *
 * `shouldCache(value)`가 false면 저장하지 않는다 — fetcher가 throw하지 않고도
 * transient-shaped 결과(예: 빈 봉, 전종목 0 quote)를 돌려줄 수 있는 호출부를 위한
 * 가드. 기본값은 항상 캐싱이며, fmpGet 기반 fetcher처럼 장애 시 throw하는 경우엔
 * 지정할 필요가 없다(잘못된 값이 애초에 set 단계에 도달하지 못하므로).
 *
 * `isFresh(value)`가 false면 envelope hit이어도 miss로 취급해 refetch 후 덮어쓴다.
 * 기본값은 항상 fresh — 기존 호출부는 영향 없음. 캐시된 값 자체(예: EOD history 겹침)로
 * staleness를 판정해야 하는 호출부를 위한 가드.
 *
 * Redis 미설정/장애 시에는 graceful fallback — `fetcher()`를 직접 호출한다.
 */
export async function getOrSetCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
    isFresh: (value: T) => boolean = () => true
): Promise<T> {
    const redis = getRedisClient();
    if (redis !== null) {
        try {
            const hit = await redis.get<unknown>(key);
            if (isCacheEnvelope<T>(hit) && isFresh(hit.data)) return hit.data;
        } catch (error) {
            console.error(`[getOrSetCache] get failed: ${key}`, error);
        }
    }

    const fresh = await fetcher();

    if (redis !== null && shouldCache(fresh)) {
        try {
            await redis.set(key, { data: fresh }, { ex: ttlSeconds });
        } catch (error) {
            console.error(`[getOrSetCache] set failed: ${key}`, error);
        }
    }
    return fresh;
}
