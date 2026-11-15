import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import { ISO_DATE_LENGTH, SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * 하루에 X에서 읽는 항목(글 + 조회한 사용자) 수의 기본 상한. X는 읽은 항목 수만큼 과금한다 — 이 값은 비용의
 * 천장이지 목표가 아니다. `AGENT_X_POSTS_PER_DAY`로 덮어쓴다.
 */
const DEFAULT_X_READS_PER_DAY = 200;
/**
 * 게스트가 함께 쓸 수 있는 몫(전체 상한의 비율). 게스트는 쿠키만 지우면 새 주체가 되므로 회원 몫까지 비우지 못하게
 * 따로 센다 — 게스트 몫이 차도 회원은 남은 전체 예산을 쓴다.
 */
const GUEST_SHARE = 0.25;
/** 하루 카운터의 TTL. 날짜가 키에 들어 있으므로 하루를 넘겨 남아 있어도 다시 읽히지 않는다. */
const COUNTER_TTL_SECONDS = 2 * SECONDS_PER_DAY;
const LOG_TAG = '[xPosts]';

/** 잘못된 값을 한 번만 경고한다 — env는 호출마다 읽는다. */
let warnedMalformedLimit = false;

/** 테스트 격리용. */
export function __resetXDailyBudgetForTests(): void {
    warnedMalformedLimit = false;
}

/** 하루 상한. `AGENT_X_POSTS_PER_DAY`가 양의 정수가 아니면 경고하고 기본값을 쓴다(상한을 풀지도 막지도 않는다). */
function xReadsPerDay(): number {
    const raw = process.env.AGENT_X_POSTS_PER_DAY;
    if (raw === undefined || raw === '') return DEFAULT_X_READS_PER_DAY;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
    if (!warnedMalformedLimit) {
        warnedMalformedLimit = true;
        console.warn(
            `${LOG_TAG} AGENT_X_POSTS_PER_DAY is not a positive integer — using the default`
        );
    }
    return DEFAULT_X_READS_PER_DAY;
}

/** 카운터 키(UTC 날짜). */
function counterKeys(now: Date): { all: string; guest: string } {
    const day = now.toISOString().slice(0, ISO_DATE_LENGTH);
    return { all: `x:reads:v1:${day}`, guest: `x:reads:guest:v1:${day}` };
}

type XReadReservation = 'reserved' | 'exhausted' | 'unavailable';

interface XReadReservationOptions {
    /** 게스트 요청이면 전체 상한과 게스트 몫을 함께 센다. */
    guest: boolean;
    now?: Date;
}

type Redis = NonNullable<ReturnType<typeof getRedisClient>>;

/**
 * `key`에 `units`를 더하고, TTL이 없는 키에만 TTL을 건다(`EXPIRE NX` — 카운터 값으로 "처음 만든 키"를 추측하지 않는다).
 * TTL 걸기가 실패하면 더한 것을 되돌리고 던진다.
 */
async function addUnits(
    redis: Redis,
    key: string,
    units: number
): Promise<number> {
    const count = await redis.incrby(key, units);
    try {
        await redis.expire(key, COUNTER_TTL_SECONDS, 'NX');
    } catch (error) {
        await redis.decrby(key, units).catch(() => undefined);
        throw error;
    }
    return count;
}

/**
 * X 요청 **직전에** 그 요청이 읽을 수 있는 최대 항목 수(`units`)를 예약한다. 먼저 더하고 넘었으면 되돌리므로
 * 동시 호출이 상한을 함께 넘기지 못한다(SERVER.md#CC-10). 실제로 읽은 수가 더 적으면 호출부가
 * {@link refundXReads}로 차이를 돌려준다. 더한 뒤 어느 단계에서 실패해도 더한 것은 되돌린다(새는 예약 없음).
 *
 * Redis가 없거나 실패하면 `unavailable`이다 — 세지 못하는 채로 과금되는 API를 부르지 않는다(fail-closed).
 */
export async function reserveXReads(
    units: number,
    { guest, now = new Date() }: XReadReservationOptions
): Promise<XReadReservation> {
    const redis = getRedisClient();
    if (redis === null) {
        console.error(`${LOG_TAG} budget store unavailable — redis not set`);
        return 'unavailable';
    }
    const limit = xReadsPerDay();
    const keys = counterKeys(now);
    const added: string[] = [];
    const rollback = async () => {
        await Promise.all(
            added.map(key => redis.decrby(key, units).catch(() => undefined))
        );
    };
    try {
        const total = await addUnits(redis, keys.all, units);
        added.push(keys.all);
        if (total > limit) {
            await rollback();
            // 운영에서 "오늘 상한에 닿았다"를 셀 수 있게 남기는 표식이다(core PUBLIC_API의 소비자 조치).
            console.warn(`${LOG_TAG} daily read budget exhausted`, { limit });
            return 'exhausted';
        }
        if (guest) {
            const guestLimit = Math.max(1, Math.floor(limit * GUEST_SHARE));
            const guestTotal = await addUnits(redis, keys.guest, units);
            added.push(keys.guest);
            if (guestTotal > guestLimit) {
                await rollback();
                console.warn(`${LOG_TAG} daily guest read budget exhausted`, {
                    limit: guestLimit,
                });
                return 'exhausted';
            }
        }
        return 'reserved';
    } catch (error) {
        await rollback();
        console.error(`${LOG_TAG} budget store unavailable`, {
            errorName: error instanceof Error ? error.name : 'unknown',
        });
        return 'unavailable';
    }
}

/** 예약했지만 쓰지 않은 항목 수를 돌려준다. 실패해도 던지지 않는다 — 덜 돌려주는 쪽이 안전한 방향이다. */
export async function refundXReads(
    units: number,
    { guest, now = new Date() }: XReadReservationOptions
): Promise<void> {
    if (units <= 0) return;
    const redis = getRedisClient();
    if (redis === null) return;
    const keys = counterKeys(now);
    try {
        await Promise.all([
            redis.decrby(keys.all, units),
            ...(guest ? [redis.decrby(keys.guest, units)] : []),
        ]);
    } catch (error) {
        console.error(`${LOG_TAG} budget refund failed`, {
            errorName: error instanceof Error ? error.name : 'unknown',
        });
    }
}
