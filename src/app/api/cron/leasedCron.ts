import { constants } from 'node:http2';
import { createRedisLease } from '@/shared/cache/createRedisLease';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { runAsBatchWork } from '@/shared/lib/renderBudget';

const {
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_ACCEPTED,
} = constants;

export interface LeasedCronOptions {
    /** 로그 접두(`[sec-13f]`)와 락 키에 쓰는 cron 이름. */
    name: string;
    /** Redis 락 TTL(초) — 보유자가 죽었을 때의 상한. `deadlineMs` + 마지막 작업 한 건 최악 시간보다 커야 한다. */
    leaseTtlSeconds: number;
    /** 새 일을 시작하지 않는 wall-clock 마감(ms). */
    deadlineMs: number;
    run: (context: { isDeadlineReached: () => boolean }) => Promise<unknown>;
}

/**
 * 수급(investor flows) 데이터 cron 3종이 공유하는 틀 — 인증 → Redis 락 → 202 즉시 반환 →
 * `afterWithDrain` 백그라운드 실행(데드라인) → 락 해제.
 *
 * - 인증 실패 401. 락이 이미 잡혀 있거나 Redis를 쓸 수 없으면 **204**(2xx — EventBridge 재시도 폭풍
 *   방지). SEC·FINRA·FMP를 두드리는 배치라 Redis 없이 중복 실행되면 SEC 속도 한도를 깨뜨릴 수 있어
 *   락을 못 잡으면 **실행하지 않는다**(fail-closed).
 * - 202를 먼저 돌려주는 이유: EventBridge API Destination 타임아웃(~5s)보다 배치가 훨씬 길다.
 * - 배치 표식(`runAsBatchWork`): FMP·Redis가 렌더 예산이 아니라 배치 정책(긴 timeout)을 쓴다.
 */
export async function handleLeasedCron(
    request: Request,
    options: LeasedCronOptions
): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }
    const lease = await runAsBatchWork(() =>
        createRedisLease(
            () => `investor-flows:cron-lock:${options.name}`,
            options.leaseTtlSeconds,
            `[${options.name}] lease`
        ).tryAcquire(undefined)
    );
    if (lease.status !== 'acquired') {
        // 메트릭 필터 접두 — 반복되면 알람(infra/aws/18-investor-flows-crons.sh): `lease held`는 이전 실행이
        // 스케줄 주기를 넘겨 매달려 있다는 뜻이고, `redis unavailable`은 이 cron이 통째로 못 돈다는 뜻이다.
        if (lease.status === 'unavailable') {
            console.error(
                `[${options.name}] redis unavailable — lease not acquired, skipping`
            );
        } else {
            console.warn(
                `[${options.name}] lease held — previous run still active, skipping`
            );
        }
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }

    afterWithDrain(() =>
        runAsBatchWork(async () => {
            const startedAt = Date.now();
            try {
                const result = await options.run({
                    isDeadlineReached: () =>
                        Date.now() - startedAt >= options.deadlineMs,
                });
                console.log(
                    `[${options.name}] run done:`,
                    JSON.stringify(result)
                );
            } catch (error) {
                console.error(`[${options.name}] run failed:`, error);
            } finally {
                await lease.release();
            }
        })
    );
    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
