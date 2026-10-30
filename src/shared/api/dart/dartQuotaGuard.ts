import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    KST_OFFSET_HOURS,
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_SECOND,
    SECONDS_PER_DAY,
} from '@/shared/config/time';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/** DART가 문서화한 하루 요청 상한(`020` 메시지 — "일반적으로는 20,000건"). */
export const DART_DAILY_QUOTA = 20_000;
/** 이 비율에 닿는 호출에서 경고를 한 번 남긴다. */
export const DART_QUOTA_WARN_RATIO = 0.8;
/**
 * 스스로 멈추는 일일 호출 수 — 상한보다 낮다. 카운터는 Redis가 안 될 때 세지 못하고, DART가 세는 단위(재시도 포함)와
 * 어긋날 수 있어 여유를 둔다. 넘으면 그날 남은 호출은 `DartQuotaError`(HTTP 없음).
 */
export const DART_DAILY_CALL_BUDGET = 19_000;

/** Redis 일일 호출 카운터 키(KST 날짜). 이틀 뒤 만료. */
export const dartDailyCallCounterKey = (kstDate: string): string =>
    `dart:calls:v1:${kstDate}`;
/** Redis 회로 차단 키 — `020`을 받은 뒤 다음 KST 자정까지 선다. 값은 차단한 KST 날짜. */
export const DART_QUOTA_BREAKER_KEY = 'dart:quota-blocked:v1';
const COUNTER_TTL_SECONDS = 2 * SECONDS_PER_DAY;
/** 회로 차단 TTL 하한 — 자정 직전에 받은 `020`도 최소 이만큼은 막는다(자정 경계의 시계 차이). */
const MIN_BREAKER_TTL_SECONDS = 60;
const BREAKER_OPEN_MESSAGE = 'daily quota breaker is open';

/** 이 프로세스가 회로 차단을 본 KST 날짜 — 같은 날 남은 호출은 Redis도 묻지 않고 막는다. */
let blockedKstDate: string | null = null;
let warnedRedisUnavailable = false;

/** 테스트 격리용 — 차단 표식과 Redis 경고 표식을 초기화한다. */
export function resetDartQuotaGuardForTests(): void {
    blockedKstDate = null;
    warnedRedisUnavailable = false;
}

/** `now`부터 다음 KST 자정까지 남은 초(하한 `MIN_BREAKER_TTL_SECONDS`). KST는 서머타임이 없어 고정 오프셋이다. */
export function secondsUntilNextKstMidnight(now: Date): number {
    const offsetMs = KST_OFFSET_HOURS * MS_PER_HOUR;
    const kstMs = now.getTime() + offsetMs;
    const nextMidnightKstMs = (Math.floor(kstMs / MS_PER_DAY) + 1) * MS_PER_DAY;
    return Math.max(
        Math.ceil((nextMidnightKstMs - kstMs) / MS_PER_SECOND),
        MIN_BREAKER_TTL_SECONDS
    );
}

function warnRedisUnavailableOnce(error?: unknown): void {
    if (warnedRedisUnavailable) return;
    warnedRedisUnavailable = true;
    console.warn(
        '[dart] redis unavailable — daily call counter and quota breaker are not shared (DART still enforces 020)',
        error instanceof Error ? error.message : (error ?? '')
    );
}

const warnThreshold = Math.ceil(DART_DAILY_QUOTA * DART_QUOTA_WARN_RATIO);

/** 할당량 가드가 요청 시도 하나에 보내는 Redis 명령 수의 최대(`get` + `incr` + `expire`) — cron 시간 예산(CC-7)이 쓴다. */
export const DART_QUOTA_GUARD_MAX_REDIS_COMMANDS = 3;

/**
 * 실제 요청 직전에 부른다 — 차단 중이면 호출부가 `DartQuotaError`로 던질 사유를, 아니면 일일 카운터를 올린 뒤 `null`을 돌려준다. Redis가 없거나 실패하면 통과시킨다
 * (fail-open: 이 가드는 DART의 `020`보다 먼저 멈추려는 보조 장치이고, `020` 자체는 응답에서 잡는다).
 */
export async function reserveCall(): Promise<string | null> {
    const today = kstDateKey(new Date());
    if (blockedKstDate === today) return BREAKER_OPEN_MESSAGE;
    const redis = getRedisClient();
    if (redis === null) {
        warnRedisUnavailableOnce();
        return null;
    }
    let count: number;
    try {
        if ((await redis.get(DART_QUOTA_BREAKER_KEY)) !== null) {
            blockedKstDate = today;
            return BREAKER_OPEN_MESSAGE;
        }
        const key = dartDailyCallCounterKey(today);
        count = await redis.incr(key);
        if (count === 1) await redis.expire(key, COUNTER_TTL_SECONDS);
    } catch (error) {
        warnRedisUnavailableOnce(error);
        return null;
    }
    if (count === warnThreshold) {
        // 메트릭 필터 접두(`infra/aws/20-dart-crons.sh`) — 인스턴스가 여럿이어도 정확히 이 값을 받는 호출은 하루 하나다.
        console.warn(
            `[dart] quota warning — ${count} of ${DART_DAILY_QUOTA} daily calls used (${today} KST)`
        );
    }
    if (count > DART_DAILY_CALL_BUDGET) {
        blockedKstDate = today;
        return `daily call budget ${DART_DAILY_CALL_BUDGET} reached`;
    }
    return null;
}

/** `020`을 받았다 — 다음 KST 자정까지 모든 인스턴스의 호출을 막는다. */
export async function openQuotaBreaker(): Promise<void> {
    const now = new Date();
    blockedKstDate = kstDateKey(now);
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(DART_QUOTA_BREAKER_KEY, blockedKstDate, {
            ex: secondsUntilNextKstMidnight(now),
        });
    } catch (error) {
        warnRedisUnavailableOnce(error);
    }
    // 메트릭 필터 접두(`infra/aws/20-dart-crons.sh`).
    console.error(
        `[dart] quota_exhausted — DART returned 020; calls blocked until the next KST midnight`
    );
}
