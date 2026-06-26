import { tryGetDatabaseClient } from '@/shared/db/client';
import { getRedisClient } from '@/shared/cache/redisClient';

// Deep readiness probe — 외부 의존성(Neon DB, Upstash Redis)까지 확인한다.
// ALB 헬스체크는 /api/health(shallow)를 쓰고, CloudWatch/알람은 이 /api/ready를
// 폴링해야 한다. 의존성 블립이 ALB 타깃을 죽이면 안 되므로 둘을 분리한다.
export const dynamic = 'force-dynamic';

/** 각 의존성 핑의 짧은 타임아웃(ms). 느린 의존성에 readiness가 매달리지 않게 한다. */
const PING_TIMEOUT_MS = 2_000;

/** 단일 의존성 점검 결과. */
interface DependencyCheck {
    ok: boolean;
    /** 실패 시 사람이 읽을 수 있는 짧은 사유(성공 시 생략). */
    error?: string;
}

/** `promise`를 최대 `ms`까지 기다리고, 초과 시 reject한다. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`timeout after ${ms}ms`)),
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

/** 에러를 짧은 문자열 메시지로 정규화한다(스택/PII 노출 방지). */
function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'unknown error';
}

/** Neon DB에 `SELECT 1`로 핑한다. 클라이언트 미구성(env 부재) 시 실패로 본다. */
async function checkDatabase(): Promise<DependencyCheck> {
    const client = tryGetDatabaseClient();
    if (client === null) {
        return { ok: false, error: 'DATABASE_URL not configured' };
    }
    try {
        await withTimeout(client.sql`SELECT 1`, PING_TIMEOUT_MS);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: toErrorMessage(err) };
    }
}

/** Upstash Redis에 `PING`한다. 클라이언트 미구성(env 부재) 시 실패로 본다. */
async function checkRedis(): Promise<DependencyCheck> {
    const redis = getRedisClient();
    if (redis === null) {
        return { ok: false, error: 'Redis not configured' };
    }
    try {
        await withTimeout(redis.ping(), PING_TIMEOUT_MS);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: toErrorMessage(err) };
    }
}

/**
 * Readiness probe. DB와 Redis가 모두 도달 가능하면 200, 하나라도 실패하면 503.
 * 두 핑을 병렬로 수행해 전체 지연이 가장 느린 의존성 한 번으로 제한된다.
 */
export async function GET(): Promise<Response> {
    const [database, redis] = await Promise.all([
        checkDatabase(),
        checkRedis(),
    ]);
    const ready = database.ok && redis.ok;
    return Response.json(
        { status: ready ? 'ready' : 'not_ready', database, redis },
        { status: ready ? 200 : 503 }
    );
}
