import 'server-only';
import { randomUUID } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';

// KEYS[1]=락 키, ARGV[1]=보유 토큰 — 저장된 값이 호출자의 토큰과 일치할 때만
// DEL한다(compare-and-delete). TTL(660s)을 넘겨 실행되는 턴이 있으면 다음 턴이
// 이미 새 토큰으로 락을 재획득할 수 있는데, 그 상태에서 첫 턴의 늦은 release가
// unconditional DEL을 하면 두 번째 턴의 락을 지워버린다. 소유권 검증 없는 DEL은
// 이 레이스를 못 막는다 — `src/app/api/cron/seo-prewarm/lock.ts`의
// `RELEASE_LOCK_SCRIPT`와 동일한 패턴(app 레이어 간 직접 import 대신 로컬 상수로 중복).
const RELEASE_LOCK_SCRIPT =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Turn deadline (core `AGENT_TURN_CAPS.turnDeadlineMs` = 600s) + 60s margin. The lock is
 * taken before the deadline timer starts (pre-turn DB calls) and released only after the
 * partial-output save and SSE teardown that follow the deadline. With TTL == deadline the key
 * could expire mid-save and let a second turn race on `seq`. Literal on purpose: reading the
 * core value at module load breaks tests that partially mock core.
 */
export const TURN_LOCK_TTL_SECONDS = 660;

/** Same marker core logs for counter-store outages; spec §12 alarms on it. */
const STORE_UNAVAILABLE_LOG = '[agent] quota store unavailable';

export interface TurnLock {
    release(): Promise<void>;
}

/**
 * One in-flight agent turn per user across instances (spec §4-5).
 * Fail-closed: returns `null` when Redis is unconfigured, the lock is
 * already held, or the SET call errors.
 */
export async function acquireTurnLock(
    userId: string
): Promise<TurnLock | null> {
    const redis = getRedisClient();
    if (redis === null) {
        console.warn(STORE_UNAVAILABLE_LOG, {
            op: 'turn-lock',
            reason: 'no redis config',
        });
        return null;
    }
    const key = `agent:turn-lock:${userId}`;
    const token = randomUUID();
    try {
        const result = await redis.set(key, token, {
            nx: true,
            ex: TURN_LOCK_TTL_SECONDS,
        });
        if (result !== 'OK') return null;
    } catch (error) {
        console.warn(STORE_UNAVAILABLE_LOG, { op: 'turn-lock', error });
        return null;
    }
    return {
        async release() {
            try {
                await redis.eval(RELEASE_LOCK_SCRIPT, [key], [token]);
            } catch (error) {
                console.warn('[agent] turn lock release failed', error);
            }
        },
    };
}
