import {
    checkDatabase,
    checkRedis,
} from '@/app/api/ready/_lib/checkDependencies';

// Deep readiness probe — 외부 의존성(Postgres DB, Upstash Redis)까지 확인한다.
// `siglens-wait-healthy.sh`/`siglens-selfcheck.timer`는 /api/health(shallow)를 쓰고,
// CloudWatch/알람은 이 /api/ready를 폴링해야 한다. 의존성 블립이 selfcheck 타깃을
// 죽이면 안 되므로 둘을 분리한다.
export const dynamic = 'force-dynamic';

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
