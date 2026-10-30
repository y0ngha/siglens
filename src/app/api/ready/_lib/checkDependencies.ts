import { getRedisClient } from '@/shared/cache/redisClient';
import { tryGetDatabaseClient } from '@/shared/db/client';

/** 각 의존성 핑의 짧은 타임아웃(ms). 느린 의존성에 readiness가 매달리지 않게 한다. */
export const PING_TIMEOUT_MS = 2_000;

/** 응답에 실리는 실패 사유. 호스트·접속 문자열이 섞일 수 있는 원본 메시지는 싣지 않는다. */
export const PING_FAILURE_REASON = {
    timeout: 'timeout',
    unreachable: 'unreachable',
} as const;

/** 단일 의존성 점검 결과. */
export interface DependencyCheck {
    ok: boolean;
    /** 실패 시 짧은 사유(성공 시 생략). 내부 오류 상세는 응답이 아니라 서버 로그에만 남는다. */
    error?: string;
}

class PingTimeoutError extends Error {}

/** `promise`를 최대 `ms`까지 기다리고, 초과 시 `PingTimeoutError`로 reject한다. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new PingTimeoutError(`timeout after ${ms}ms`)),
            ms
        );
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            err => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

/**
 * 핑 하나를 실행해 결과로 접는다. 실패 원문은 서버 로그에만 남기고 응답에는 분류된 사유만 낸다 —
 * 이 라우트는 인증이 없어, 드라이버 오류 메시지의 내부 주소·포트가 그대로 노출되면 안 된다.
 */
async function runPing(
    label: string,
    ping: () => Promise<unknown>
): Promise<DependencyCheck> {
    try {
        await withTimeout(ping(), PING_TIMEOUT_MS);
        return { ok: true };
    } catch (err) {
        console.error(`[ready] ${label} ping failed:`, err);
        return {
            ok: false,
            error:
                err instanceof PingTimeoutError
                    ? PING_FAILURE_REASON.timeout
                    : PING_FAILURE_REASON.unreachable,
        };
    }
}

/**
 * DB에 `SELECT 1`로 핑한다. 원시 `sql`(postgres-js)은 drizzle 로거를 우회해
 * `unstable_noStore` 신호를 보내지 않는다 — `/api/ready`는 `force-dynamic`이라 무관하다.
 * 클라이언트 미구성(env 부재) 시 실패로 본다.
 */
export async function checkDatabase(): Promise<DependencyCheck> {
    const client = tryGetDatabaseClient();
    if (client === null) {
        return { ok: false, error: 'DATABASE_URL not configured' };
    }
    return runPing('database', () => client.sql`SELECT 1`);
}

/** Upstash Redis에 `PING`한다. 클라이언트 미구성(env 부재) 시 실패로 본다. */
export async function checkRedis(): Promise<DependencyCheck> {
    const redis = getRedisClient();
    if (redis === null) {
        return { ok: false, error: 'Redis not configured' };
    }
    return runPing('redis', () => redis.ping());
}
