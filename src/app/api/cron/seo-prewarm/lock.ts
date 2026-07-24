import 'server-only';
import { randomUUID } from 'crypto';
import { getRedisClient } from '@/shared/cache/redisClient';

// KEYS[1]=락 키, ARGV[1]=보유 토큰 — 저장된 값이 호출자의 토큰과 일치할 때만 DEL한다
// (compare-and-delete). TTL 만료로 새 실행이 이미 재획득한 락을 옛 실행의 finally가
// 지워버리는 레이스를 막는다 — 소유권 증명 없는 unconditional DEL은 그 레이스를 못 막는다.
const RELEASE_LOCK_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

const LOCK_KEY = 'seo-prewarm:lock';
const LOCK_TTL_SECONDS = 900; // 15min ≥ 최대 배치 시간 (spec §6 락 라이프사이클)
const INFLIGHT_TTL_SECONDS = 1800; // 30min
const FMP_BUDGET_TTL_SECONDS = 172800; // 2d — 날짜 키 자연 롤오버, TTL은 청소용

/**
 * SET NX EX로 루트 락을 획득하고, 성공 시 이번 실행 고유의 소유 토큰을 반환한다.
 *
 * EventBridge가 겹쳐 트리거되더라도 단일 인스턴스만 pre-warm 배치를 실행하도록
 * 보장한다. redis 미구성(cron 환경에서는 필수 전제) 시 실행을 거부하고 에러를
 * 로그한다 — degrade하면 락 없이 중복 실행되므로 여기서는 fail-closed.
 *
 * @returns 획득 성공 시 소유 토큰(`releasePrewarmLock`에 그대로 전달), 실패 시 null.
 */
export async function acquirePrewarmLock(): Promise<string | null> {
    const redis = getRedisClient();
    if (redis === null) {
        console.error('[seo-prewarm] redis unavailable — cannot run');
        return null;
    }
    const token = randomUUID();
    const result = await redis.set(LOCK_KEY, token, {
        nx: true,
        ex: LOCK_TTL_SECONDS,
    });
    return result === 'OK' ? token : null;
}

/**
 * 루트 락을 compare-and-delete로 해제한다 — 저장된 값이 호출자의 `token`과
 * 일치할 때만 DEL한다(Lua eval, 원자적). LOCK_TTL_SECONDS(900s)를 초과하는
 * 배치가 있으면 락이 만료돼 새 실행이 새 토큰으로 재획득할 수 있는데, 이때
 * 옛 실행의 `finally`가 unconditional DEL을 했다면 새 실행의 락을 지워
 * 두 배치가 동시에 도는 상태가 된다. 소유권 검증으로 이를 막는다.
 * redis 미구성 시 noop.
 */
export async function releasePrewarmLock(token: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.eval(RELEASE_LOCK_SCRIPT, [LOCK_KEY], [token]);
}

/** (symbol, tab) 조합을 in-flight로 마킹해 중복 워커 enqueue를 막는다. */
export async function markInFlight(symbol: string, tab: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.set(
        `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`,
        '1',
        {
            ex: INFLIGHT_TTL_SECONDS,
        }
    );
}

/** (symbol, tab) 조합이 현재 in-flight 상태인지 조회한다. */
export async function isInFlight(
    symbol: string,
    tab: string
): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    return (
        (await redis.get(
            `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`
        )) !== null
    );
}

function fmpBudgetKey(now = new Date()): string {
    return `seo-prewarm:fmp-budget:${now.toISOString().slice(0, 10)}`;
}

/** 오늘자 FMP 호출 카운터에 calls를 더하고 누적값을 반환한다(모니터링용). */
export async function addFmpBudget(calls: number): Promise<number> {
    const redis = getRedisClient();
    if (redis === null) return 0;
    const key = fmpBudgetKey();
    const total = await redis.incrby(key, calls);
    await redis.expire(key, FMP_BUDGET_TTL_SECONDS);
    return total;
}

/** 오늘자 FMP 호출 누적 사용량을 조회한다. */
export async function getFmpBudgetUsed(): Promise<number> {
    const redis = getRedisClient();
    if (redis === null) return 0;
    const value = await redis.get(fmpBudgetKey());
    return typeof value === 'number' ? value : Number(value ?? 0);
}
