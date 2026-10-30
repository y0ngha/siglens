import 'server-only';
import {
    buildRateLimitSnapshot,
    counterKey,
    listRateSlots,
    verdictFor,
    windowId,
    type RateLimitSnapshot,
    type RateLimitVerdict,
    type WindowId,
} from '@/entities/siglens-api-key/lib/rateLimitWindow';
import { getRedisClient } from '@/shared/cache/redisClient';
import type { PublicApiRateBucket } from '@/shared/config/publicApi';

/**
 * 한도 저장소(Redis)를 쓸 수 없다. API는 외부 공개면이라 fail-open하지 않는다 —
 * 호출부가 503 `rate_limiter_unavailable`로 거절한다.
 */
export class RateLimiterUnavailableError extends Error {
    constructor(options?: ErrorOptions) {
        super('Rate limiter unavailable', options);
        this.name = 'RateLimiterUnavailableError';
    }
}

/**
 * 창 카운터를 올린다. INCR과 EXPIRE를 한 MULTI로 보내 INCR만 반영되고 프로세스가 죽어
 * 만료 없는 키가 남는 일이 없게 한다(키에 창 id가 들어 있어 TTL을 매번 같은 값으로
 * 다시 걸어도 창이 늘어나지 않는다).
 */
async function incrementWindow(
    userId: string,
    bucket: PublicApiRateBucket,
    w: WindowId
): Promise<number> {
    const redis = getRedisClient();
    if (redis === null) throw new RateLimiterUnavailableError();
    try {
        const key = counterKey(userId, bucket, w);
        const [count] = await redis
            .multi()
            .incr(key)
            .expire(key, w.ttlSeconds)
            .exec<[number, number]>();
        if (typeof count !== 'number')
            throw new Error('INCR returned a non-number');
        return count;
    } catch (cause) {
        if (cause instanceof RateLimiterUnavailableError) throw cause;
        console.error('[publicApiRateLimit] redis error:', cause);
        throw new RateLimiterUnavailableError({ cause });
    }
}

/**
 * 회원(userId) 단위로 한 번 소비한다. 키(keyId)로 세면 폐기 뒤 재발급이나 키 5개 돌려쓰기로
 * 한도가 초기화되므로 소유 회원이 한 몸이다.
 * 분 창을 먼저 올리고, 분 한도를 넘기면 일 카운터를 건드리지
 * 않는다 — 분 한도에 막힌 재시도가 일 한도를 깎지 않는다. 일 창 거절은 분 카운터를 이미
 * 올린 뒤이므로 그 분 동안은 어차피 거절된다.
 *
 * @throws {RateLimiterUnavailableError} Redis 미설정·명령 실패
 */
export async function consumeRateLimit(
    userId: string,
    bucket: PublicApiRateBucket,
    now: Date = new Date()
): Promise<RateLimitVerdict> {
    const minute = windowId('minute', now);
    const minuteVerdict = verdictFor(
        bucket,
        minute,
        await incrementWindow(userId, bucket, minute),
        now
    );
    if (!minuteVerdict.allowed) return minuteVerdict;

    const day = windowId('day', now);
    const dayVerdict = verdictFor(
        bucket,
        day,
        await incrementWindow(userId, bucket, day),
        now
    );
    return dayVerdict.allowed ? minuteVerdict : dayVerdict;
}

/**
 * 소비 없이 남은 한도를 읽는다(`/api/v1/me`). Redis를 못 읽으면 `null` — `/me`는
 * 한도 표시 때문에 죽지 않고 해당 필드를 비운다.
 */
export async function peekRateLimits(
    userId: string,
    now: Date = new Date()
): Promise<RateLimitSnapshot | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    const slots = listRateSlots(now);
    try {
        const counts = await redis.mget<(number | string | null)[]>(
            ...slots.map(({ bucket, w }) => counterKey(userId, bucket, w))
        );
        return buildRateLimitSnapshot(slots, counts);
    } catch (error) {
        console.error('[publicApiRateLimit] peek failed:', error);
        return null;
    }
}
