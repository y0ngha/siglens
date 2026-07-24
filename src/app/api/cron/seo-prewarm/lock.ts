import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';

const LOCK_KEY = 'seo-prewarm:lock';
const LOCK_TTL_SECONDS = 900; // 15min ≥ 최대 배치 시간 (spec §6 락 라이프사이클)
const INFLIGHT_TTL_SECONDS = 1800; // 30min
const FMP_BUDGET_TTL_SECONDS = 172800; // 2d — 날짜 키 자연 롤오버, TTL은 청소용

/**
 * SET NX EX로 루트 락을 획득한다.
 *
 * EventBridge가 겹쳐 트리거되더라도 단일 인스턴스만 pre-warm 배치를 실행하도록
 * 보장한다. redis 미구성(cron 환경에서는 필수 전제) 시 실행을 거부하고 에러를
 * 로그한다 — degrade하면 락 없이 중복 실행되므로 여기서는 fail-closed.
 */
export async function acquirePrewarmLock(): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) {
        console.error('[seo-prewarm] redis unavailable — cannot run');
        return false;
    }
    const result = await redis.set(LOCK_KEY, String(Date.now()), {
        nx: true,
        ex: LOCK_TTL_SECONDS,
    });
    return result === 'OK';
}

/** 루트 락을 해제한다. redis 미구성 시 noop. */
export async function releasePrewarmLock(): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.del(LOCK_KEY);
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
