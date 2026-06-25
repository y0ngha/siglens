import 'server-only';
import { getRedisClient } from './redisClient';

/** 고정 Redis 키를 사용하는 boolean-flag 핸들 (인수 없음 모드). */
export interface RedisFlagHandle {
    isSet: () => Promise<boolean>;
    mark: () => Promise<void>;
}

/** 동적 Redis 키를 사용하는 boolean-flag 핸들 (파라미터 모드). */
export interface RedisFlagHandleWithArg<A> {
    isSet: (arg: A) => Promise<boolean>;
    mark: (arg: A) => Promise<void>;
}

/**
 * Redis boolean-flag 팩토리 — 모든 refresh-flag 모듈이 공유하는 get/set 패턴.
 *
 * 각 flag는 단일 Redis 키(고정 키 또는 파라미터를 받는 함수)와 TTL을 가진다.
 * Redis 미구성/장애 시 isSet은 false(=항상 fetch), mark는 noop으로 degrade한다.
 *
 * @param key        - 고정 Redis 키 문자열.
 * @param ttlSeconds - Redis EX 값(초).
 * @param logPrefix  - 오류 로그에 표시할 슬라이스 식별자 (예: '[newsRefreshFlag]').
 */
export function createRedisFlag(
    key: string,
    ttlSeconds: number,
    logPrefix?: string
): RedisFlagHandle;

/**
 * Redis boolean-flag 팩토리 — 파라미터로 Redis 키를 동적으로 생성하는 모드.
 *
 * @param keyFn      - 파라미터를 받아 Redis 키를 반환하는 함수.
 * @param ttlSeconds - Redis EX 값(초).
 * @param logPrefix  - 오류 로그에 표시할 슬라이스 식별자 (예: '[newsRefreshFlag]').
 */
export function createRedisFlag<A>(
    keyFn: (arg: A) => string,
    ttlSeconds: number,
    logPrefix?: string
): RedisFlagHandleWithArg<A>;

// 구현부 — 오버로드 시그니처에 노출되지 않음. 런타임 동작은 기존과 동일.
export function createRedisFlag(
    keyOrFn: string | ((arg: unknown) => string),
    ttlSeconds: number,
    logPrefix = ''
) {
    const resolveKey = (arg?: unknown): string =>
        typeof keyOrFn === 'function' ? keyOrFn(arg) : keyOrFn;

    async function isSet(arg?: unknown): Promise<boolean> {
        const redis = getRedisClient();
        if (redis === null) return false;
        try {
            return (await redis.get(resolveKey(arg))) !== null;
        } catch (error) {
            console.error(`${logPrefix} get failed`, error);
            return false;
        }
    }

    async function mark(arg?: unknown): Promise<void> {
        const redis = getRedisClient();
        if (redis === null) return;
        try {
            await redis.set(resolveKey(arg), '1', { ex: ttlSeconds });
        } catch (error) {
            console.error(`${logPrefix} set failed`, error);
        }
    }

    return { isSet, mark };
}
