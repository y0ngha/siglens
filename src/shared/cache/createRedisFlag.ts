import 'server-only';
import { getRedisClient } from './redisClient';

/**
 * Redis boolean-flag 팩토리 — 모든 refresh-flag 모듈이 공유하는 get/set 패턴.
 *
 * 각 flag는 단일 Redis 키(고정 키 또는 파라미터를 받는 함수)와 TTL을 가진다.
 * Redis 미구성/장애 시 isSet은 false(=항상 fetch), mark는 noop으로 degrade한다.
 *
 * 반환 인터페이스:
 * - `isSet(key?)` — 플래그가 설정돼 있으면 true
 * - `mark(key?)`  — 플래그를 TTL 동안 '1'로 세팅
 *
 * @param keyOrFn  - 고정 문자열이거나 파라미터를 받아 Redis 키를 반환하는 함수.
 * @param ttlSeconds - Redis EX 값(초).
 * @param logPrefix  - 오류 로그에 표시할 슬라이스 식별자 (예: '[newsRefreshFlag]').
 */
export function createRedisFlag<TKey extends string | void = void>(
    keyOrFn: TKey extends string ? (param: TKey) => string : string,
    ttlSeconds: number,
    logPrefix: string
): {
    isSet: TKey extends string
        ? (param: TKey) => Promise<boolean>
        : () => Promise<boolean>;
    mark: TKey extends string
        ? (param: TKey) => Promise<void>
        : () => Promise<void>;
} {
    // 런타임 분기: keyOrFn이 함수면 파라미터를 받고, 문자열이면 무시한다.
    // 조건부 반환 타입은 호출자 편의를 위한 것이며, 내부 구현은 단일 경로다.
    const resolveKey = (param?: string): string =>
        typeof keyOrFn === 'function'
            ? (keyOrFn as (p: string) => string)(param ?? '')
            : (keyOrFn as string);

    async function isSet(param?: string): Promise<boolean> {
        const redis = getRedisClient();
        if (redis === null) return false;
        try {
            return (await redis.get(resolveKey(param))) !== null;
        } catch (error) {
            console.error(`${logPrefix} get failed`, error);
            return false;
        }
    }

    async function mark(param?: string): Promise<void> {
        const redis = getRedisClient();
        if (redis === null) return;
        try {
            await redis.set(resolveKey(param), '1', { ex: ttlSeconds });
        } catch (error) {
            console.error(`${logPrefix} set failed`, error);
        }
    }

    // 조건부 반환 타입은 호출자 시그니처 편의용 — 런타임 값은 동일 함수.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { isSet, mark } as any;
}
