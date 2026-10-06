import 'server-only';
import { randomUUID } from 'node:crypto';
import { getRedisClient } from './redisClient';

/**
 * KEYS[1]=락 키, ARGV[1]=보유 토큰 — 저장된 값이 호출자의 토큰일 때만 지운다(compare-and-delete).
 * `app/api/ai/chat/turnLock.ts`·`app/api/cron/seo-prewarm/lock.ts`와 같은 스크립트다.
 */
const RELEASE_LEASE_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * 락 획득 결과.
 *
 * - `acquired`: 이번 호출이 `SET NX`로 실제로 잡았다. `release()`는 **자기 토큰일 때만** 지운다.
 * - `held`: 다른 보유자가 있다.
 * - `unavailable`: Redis 미설정·장애 — fail-open이라 호출자는 진행해도 되지만, 잡은 것이
 *   없으므로 풀 것도 없다(`release`가 없다).
 */
export type RedisLease =
    | { readonly status: 'acquired'; readonly release: () => Promise<void> }
    | { readonly status: 'held' }
    | { readonly status: 'unavailable' };

/** 파라미터로 키를 정하는 토큰 락 핸들. */
export interface RedisLeaseHandle<A> {
    tryAcquire: (arg: A) => Promise<RedisLease>;
}

/**
 * 소유권을 확인하고 푸는 fail-open 락 팩토리 — "이 작업은 지금 한 명만" 용도.
 *
 * `createRedisSlot`(쿨다운 슬롯)과 다른 점: 슬롯은 TTL 동안 **남겨 두는 것**이 목적이고
 * 실패했을 때만 무조건 `DEL`한다. 락은 작업이 끝나면 **항상** 푸는데, TTL이 먼저 만료돼 다른
 * 인스턴스가 새로 잡은 뒤에 늦은 `DEL`이 오면 남의 락을 지운다. 그래서 획득마다 무작위 토큰을
 * 값으로 쓰고, 풀 때는 그 토큰일 때만 지운다.
 *
 * @param keyFn      - 파라미터를 받아 Redis 키를 반환하는 함수.
 * @param ttlSeconds - 락 유지 시간(Redis EX, 초). 보유자가 죽었을 때의 상한이다.
 * @param logPrefix  - 오류 로그에 표시할 슬라이스 식별자.
 */
export function createRedisLease<A>(
    keyFn: (arg: A) => string,
    ttlSeconds: number,
    logPrefix: string
): RedisLeaseHandle<A> {
    async function tryAcquire(arg: A): Promise<RedisLease> {
        const redis = getRedisClient();
        if (redis === null) return { status: 'unavailable' };
        const key = keyFn(arg);
        const token = randomUUID();
        try {
            const result = await redis.set(key, token, {
                nx: true,
                ex: ttlSeconds,
            });
            if (result !== 'OK') return { status: 'held' };
        } catch (error) {
            console.error(`${logPrefix} acquire failed`, error);
            return { status: 'unavailable' };
        }
        return {
            status: 'acquired',
            async release() {
                try {
                    await redis.eval(RELEASE_LEASE_SCRIPT, [key], [token]);
                } catch (error) {
                    console.error(`${logPrefix} release failed`, error);
                }
            },
        };
    }

    return { tryAcquire };
}
