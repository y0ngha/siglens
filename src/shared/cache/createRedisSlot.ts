import 'server-only';
import { getRedisClient } from './redisClient';

/** 파라미터로 키를 정하는 생성 슬롯 핸들. */
export interface RedisSlotHandle<A> {
    /**
     * 슬롯을 잡는다(`SET NX EX`). 이번에 처음 세웠으면 true, 이미 서 있으면 false.
     * Redis 미설정·장애는 true(fail-open).
     */
    tryAcquire: (arg: A) => Promise<boolean>;
    /** 슬롯을 돌려준다(`DEL`). 실패는 삼킨다 — TTL이 결국 푼다. */
    release: (arg: A) => Promise<void>;
}

/**
 * "이 기간에 한 명만 생성한다" 슬롯 팩토리 — LLM 생성 쿨다운용.
 *
 * `createRedisFlag`의 isSet → mark는 두 왕복 사이가 비어 있어, 동시에 도착한 방문자
 * 여럿이 모두 "비어 있음"을 보고 모두 생성한다. 확인과 표시를 `SET NX` 한 명령으로
 * 묶어 한 명만 통과시킨다.
 *
 * **fail-open이다** — Redis 미설정·장애면 `tryAcquire`가 true를 돌려준다
 * (`createRedisFlag`의 isSet이 false로 degrade하는 것과 같은 방향). 이 슬롯은 비용 절감
 * 장치이지 정확성 장치가 아니라, 막혀서 콘텐츠가 아예 안 나오는 쪽보다 예전처럼
 * 생성되는 쪽이 낫다.
 *
 * @param keyFn      - 파라미터를 받아 Redis 키를 반환하는 함수.
 * @param ttlSeconds - 슬롯 유지 시간(Redis EX, 초).
 * @param logPrefix  - 오류 로그에 표시할 슬라이스 식별자.
 */
export function createRedisSlot<A>(
    keyFn: (arg: A) => string,
    ttlSeconds: number,
    logPrefix: string
): RedisSlotHandle<A> {
    async function tryAcquire(arg: A): Promise<boolean> {
        const redis = getRedisClient();
        if (redis === null) return true;
        try {
            const result = await redis.set(keyFn(arg), '1', {
                nx: true,
                ex: ttlSeconds,
            });
            return result === 'OK';
        } catch (error) {
            console.error(`${logPrefix} acquire failed`, error);
            return true;
        }
    }

    async function release(arg: A): Promise<void> {
        const redis = getRedisClient();
        if (redis === null) return;
        try {
            await redis.del(keyFn(arg));
        } catch (error) {
            console.error(`${logPrefix} release failed`, error);
        }
    }

    return { tryAcquire, release };
}
