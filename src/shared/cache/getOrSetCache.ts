import 'server-only';
import type { Redis } from '@upstash/redis';
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
 * 진행 중인 miss 처리(fetch + set)를 키 단위로 공유하는 맵.
 *
 * 이게 없으면 같은 키의 동시 miss가 전부 독립적으로 fetch하고 전부 Redis에 쓴다
 * (캐시 스탬피드). 한 종목 페이지 렌더는 차트·분석·fear&greed가 **같은**
 * `bars:eodhist:<SYM>:<date>` 키를 병렬로 요청하고(CachedMarketDataProvider 주석의
 * "차트·분석·today-quote·fear&greed 1Day가 같은 캐시를 공유한다" 참조), 동시
 * 방문자와 pre-warm cron이 여기에 겹친다. 44KB짜리 봉 배열이 한 번의 만료마다
 * 수십 번 재기록되던 이유다.
 *
 * 2026-08 실측: 키 갱신량으로 역산한 Redis 쓰기는 0.25GB/일인데 실제 AWS 청구
 * 아웃바운드는 4.3GB/일이었다(17배). 중복 fetch는 FMP 쿼터도 같은 배수로 태운다.
 *
 * 형제 격인 `CachedFundamentalProvider`는 모든 메서드를 `React.cache`로 감싸
 * 요청 스코프 dedup을 이미 갖고 있다. 이 맵은 그보다 넓다 — 요청 경계를 넘고,
 * RSC 밖(cron, route handler)에서도 동작한다.
 *
 * 프로세스 로컬이므로 인스턴스 간에는 공유되지 않는다. 목적이 정합성이 아니라
 * 중복 제거라 그걸로 충분하다.
 *
 * ## 이 dedup이 만드는 결합 (알고 쓸 것)
 *
 * 동시 호출자들이 한 promise를 공유하므로 **소유자의 인자가 전원에게 적용된다**:
 * `shouldCache`와 `ttlSeconds`는 소유자 것이 쓰이고 대기자 것은 조용히 버려진다.
 * 같은 키를 서로 다른 정책으로 호출하는 곳이 생기면 여기부터 의심할 것.
 * (`isFresh`만 예외 — 대기자가 자기 기준으로 재검증하고 필요하면 직접 fetch한다.)
 *
 * 그리고 **fetcher가 영원히 안 끝나면 그 키의 이후 호출자도 같이 멈춘다**. 변경 전에는
 * 호출자끼리 독립이었다. FMP·Yahoo·KRX 경로는 `AbortSignal.timeout`이 걸려 있어
 * 상한이 있지만, DB 기반 호출부(`economySnapshotCache`, `sectorSignalsCache`,
 * `marketSummaryCache`)는 없다 — 그쪽에 타임아웃을 붙일 때 이 결합을 근거로 삼을 것.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * miss 경로: fetch 후 조건부로 Redis에 기록한다. Redis 쓰기 실패는 삼킨다 —
 * 값 자체는 이미 확보했으므로 호출부에 전파할 이유가 없다.
 */
async function fetchAndStore<T>(
    redis: Redis | null,
    key: string,
    ttlSeconds: number | ((value: T) => number),
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean
): Promise<T> {
    const fresh = await fetcher();

    if (redis !== null && shouldCache(fresh)) {
        const ex =
            typeof ttlSeconds === 'function' ? ttlSeconds(fresh) : ttlSeconds;
        try {
            await redis.set(key, { data: fresh }, { ex });
        } catch (error) {
            console.error(`[getOrSetCache] set failed: ${key}`, error);
        }
    }
    return fresh;
}

/**
 * Read-through Redis 캐시 헬퍼. get→fetch→set 패턴을 일반화해 호출부의
 * 보일러플레이트를 줄인다. 같은 키의 동시 miss는 하나의 fetch+set으로 접힌다
 * (위 `inFlight` 주석 참조).
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
 * ⚠️ 단, **in-flight 공유 결과가 `isFresh`를 통과하지 못한 경우에는 덮어쓰지 않는다** —
 * 그 경로는 직접 fetch한 값을 호출부에만 돌려주고 캐시는 소유자가 쓴 값을 유지한다.
 * 좁은 기준의 대기자가 넓은 기준으로 저장된 캐시를 축소 덮어쓰는 것을 막기 위함이다.
 *
 * `ttlSeconds`는 숫자 또는 fetch된 값을 받아 TTL(초)을 반환하는 함수다. 함수 형태를 쓰면
 * 결과에 따라 TTL을 달리할 수 있다(예: FMP EOD 미발행/지연 시 짧은 재시도 TTL). 숫자 호출부는
 * 영향 없음.
 *
 * Redis 미설정/장애 시에는 graceful fallback — `fetcher()`를 직접 호출한다.
 */
export async function getOrSetCache<T>(
    key: string,
    ttlSeconds: number | ((value: T) => number),
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

    // `as` 근거: 맵은 `Promise<unknown>`을 담으므로 키와 `T`의 연결은 컴파일러가
    // 강제하지 못한다. 런타임 보장은 호출 규약에서 온다 — 캐시 키는 값 타입을 결정하는
    // 식별자이고(예: `bars:eodhist:<SYM>:<date>`는 언제나 `Bar[]`), 같은 키에 서로 다른
    // `T`로 접근하는 호출부는 이미 Redis 계층에서도 깨진다(같은 직렬화 값을 공유하므로).
    // 즉 이 캐스트는 새로운 타입 구멍을 만들지 않고 기존 규약을 그대로 따른다.
    const shared = inFlight.get(key) as Promise<T> | undefined;
    if (shared !== undefined) {
        const value = await shared;
        // `isFresh`는 호출부마다 다를 수 있다(예: `bars:eodhist`는 요청 `from`을
        // 커버하는지로 판정). 공유 결과가 내 기준에 못 미치면 dedup을 포기하고
        // 직접 fetch한다 — 잘림(truncation)을 방지하는 정확성 가드다.
        // 이 경로는 캐시에 쓰지 않는다: 소유자가 방금 쓴 값을 좁은 기준으로
        // 덮어쓰면 다른 호출부의 캐시를 무효화하기 때문이다.
        if (isFresh(value)) return value;
        return fetcher();
    }

    const pending = fetchAndStore(redis, key, ttlSeconds, fetcher, shouldCache);
    inFlight.set(key, pending);
    try {
        return await pending;
    } finally {
        inFlight.delete(key);
    }
}

/** in-flight 맵을 비운다(테스트 격리용). */
export function __resetInFlightForTests(): void {
    inFlight.clear();
}
