import { constants } from 'node:http2';
import {
    createRedisLease,
    type RedisLease,
} from '@/shared/cache/createRedisLease';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { runAsBatchWork } from '@/shared/lib/renderBudget';

const {
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_ACCEPTED,
} = constants;

/**
 * SEC를 대량으로 두드리는 cron(`sec-13f`·`sec-ftd`)이 함께 잡는 락 이름. SEC 속도 게이트는 프로세스 안 변수라 인스턴스 사이에
 * 공유되지 않으므로, 이 락 하나로 **동시에 한 SEC cron만** 돌게 해 인스턴스 합계를 게이트 한 개 속도로 묶는다
 * (`shared/config/investorFlows.ts`의 `SEC_MIN_REQUEST_INTERVAL_MS` 불변식).
 *
 * ── 한 번뿐인 배포 겹침(이 락을 도입한 릴리스) ──────────────────────────────────────────────────────────
 * 이전 릴리스의 `sec-13f`는 이름별 키 `investor-flows:cron-lock:sec-13f`를 잡는다. 롤링 배포 동안 옛 인스턴스와 새 인스턴스가
 * 함께 떠 있으면 두 키가 달라 서로를 막지 못한다. 그래서 이 릴리스의 `sec-13f`는 공유 키와 **옛 키도 함께** 잡는다
 * (`legacyLeaseNames: [SEC_13F_LEGACY_LEASE_NAME]`) — 옛 인스턴스가 돌고 있으면 새 `sec-13f`는 204로 건너뛴다. 남는 겹침은
 * 옛 `sec-13f`(옛 키만)와 새 `sec-ftd`(공유 키만)가 동시에 도는 경우뿐이고, 옛 인스턴스가 모두 내려가는 배포 시간(수 분) +
 * 옛 실행 하나의 락 TTL(35분) 안으로 묶인다(그동안 SEC 합계 속도가 한 번 최대 두 배 — SEC 공식 한도 10건/초 아래).
 */
export const SEC_CRON_LEASE_NAME = 'sec';

/**
 * 이전 릴리스 `sec-13f`의 이름별 락 이름. 공유 락으로 옮긴 배포 동안의 겹침을 막으려고 이 릴리스의 `sec-13f`가 함께 잡는다.
 * TODO(investor-flows 확장 다음 릴리스): 옛 인스턴스가 모두 내려간 뒤 이 상수와 `sec-13f/route.ts`의 `legacyLeaseNames`를 지운다.
 */
export const SEC_13F_LEGACY_LEASE_NAME = 'sec-13f';

const leaseKey = (name: string): string => `investor-flows:cron-lock:${name}`;

export interface LeasedCronOptions {
    /** 로그 접두(`[sec-13f]`)에 쓰는 cron 이름. `leaseName`이 없으면 락 키도 이 이름이다. */
    name: string;
    /** 락 키 이름(`investor-flows:cron-lock:<leaseName>`). 여러 cron이 한 락을 공유할 때만 준다(`SEC_CRON_LEASE_NAME`). */
    leaseName?: string;
    /**
     * 함께 잡을 **옛** 락 이름들 — 락 키를 바꾼 릴리스의 배포 동안 옛 버전 인스턴스와 겹치지 않게 한다. 하나라도 잡혀 있으면
     * 이미 잡은 락을 풀고 204로 건너뛴다. 옛 인스턴스가 사라진 다음 릴리스에서 지운다.
     */
    legacyLeaseNames?: readonly string[];
    /** Redis 락 TTL(초) — 보유자가 죽었을 때의 상한. `deadlineMs` + 마지막 작업 한 건 최악 시간보다 커야 한다. */
    leaseTtlSeconds: number;
    /** 새 일을 시작하지 않는 wall-clock 마감(ms). */
    deadlineMs: number;
    run: (context: { isDeadlineReached: () => boolean }) => Promise<unknown>;
}

/**
 * 수급(investor flows) 데이터 cron들이 공유하는 틀 — 인증 → Redis 락 → 202 즉시 반환 →
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
    const acquired: Extract<RedisLease, { status: 'acquired' }>[] = [];
    const releaseAll = async (): Promise<void> => {
        for (const held of acquired) {
            // 락마다 하나씩 — 순서는 상관없지만 Redis를 한 번에 두드릴 이유가 없다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await held.release();
        }
    };
    for (const name of [
        options.leaseName ?? options.name,
        ...(options.legacyLeaseNames ?? []),
    ]) {
        // 키는 차례로 잡는다 — 앞 키를 못 잡으면 뒤 키는 시도하지 않는다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const lease = await runAsBatchWork(() =>
            createRedisLease(
                () => leaseKey(name),
                options.leaseTtlSeconds,
                `[${options.name}] lease`
            ).tryAcquire(undefined)
        );
        if (lease.status === 'acquired') {
            acquired.push(lease);
            continue;
        }
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await runAsBatchWork(releaseAll);
        // 메트릭 필터 접두 — 반복되면 알람(infra/aws/18-investor-flows-crons.sh·19-*): `lease held`는 이전 실행이
        // 스케줄 주기를 넘겨 매달려 있다는 뜻이고(공유 락이면 다른 SEC cron이, 옛 락이면 옛 버전 인스턴스가 돌고 있다는 뜻일
        // 수도 있다), `redis unavailable`은 이 cron이 통째로 못 돈다는 뜻이다.
        if (lease.status === 'unavailable') {
            console.error(
                `[${options.name}] redis unavailable — lease not acquired, skipping`
            );
        } else {
            console.warn(
                `[${options.name}] lease held — previous run still active, skipping (${leaseKey(name)})`
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
                await releaseAll();
            }
        })
    );
    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
