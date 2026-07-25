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
// FIX C(감사) — terminal skip(error/miss_no_trigger/no_trades/no_chains_error/null)
// 상태의 (symbol, tab)에 6h backoff를 건다. 5분 tick 기준 그대로 두면 하룻밤에
// ~96회 재시도되며 head 슬롯을 영구 점유한다 — 6h TTL이면 하룻밤에 최대 ~2회로 줄어든다.
const SKIP_TTL_SECONDS = 21600; // 6h

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

/**
 * (symbol, tab) 조합을 in-flight로 마킹해 중복 워커 enqueue를 막는다.
 *
 * FIX Z(감사) — `jobId`를 함께 저장하면(생략 시 legacy 값 `'1'`) 다음 tick이
 * 새 job을 다시 submit하는 대신 이 값으로 기존 job을 이어서 poll할 수 있다
 * (`getInFlightMarker` 참고). `pending_dependencies`처럼 단일 jobId가 없는
 * 경우엔 `jobId`를 생략해 legacy 마커로 남긴다.
 *
 * FIX 1(감사, PR #698 리뷰) — legacy 마커(jobId 없음)는 "재개 불가"이지만
 * "in-flight가 아님"은 아니다: 여전히 이 (symbol, tab)은 다른 워커가 처리
 * 중이거나 poll 불가능한 방식(예: `pending_dependencies`의 축별 pendingJobs)으로
 * 진행 중이므로, 소비자는 이를 "지금 이 tick엔 손대지 말고 TTL 만료를
 * 기다려라"로 해석해야 한다(재제출 금지). `getInFlightMarker`가 이 구분을
 * `{ present, jobId }`로 노출한다.
 */
export async function markInFlight(
    symbol: string,
    tab: string,
    jobId?: string
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.set(
        `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`,
        jobId ?? '1',
        {
            ex: INFLIGHT_TTL_SECONDS,
        }
    );
}

/**
 * (symbol, tab) 마커 상태를 단일 Redis GET으로 조회한다(FIX 1, 감사 PR #698
 * 리뷰). 이전엔 `isInFlight`(마커 존재?)와 `getInFlightJobId`(resumable
 * jobId?)가 별도 함수였는데, `isInFlight`는 프로덕션 어디서도 호출되지 않는
 * 죽은 코드였고 `getInFlightJobId`만 쓰였다. 그 결과 legacy 마커(jobId 없이
 * `markInFlight`된 경우 — 예: `overall`의 `pending_dependencies`)가 있는
 * (symbol, tab)도 `getInFlightJobId`가 null을 반환해 "in-flight 아님"으로
 * 오판되어 매 5분 tick마다 재제출됐다(FMP 예산 재계상 포함) — `markInFlight`의
 * 문서화된 의도("재개 불가, 자연 TTL 만료 후 재시도")와 정면으로 어긋났다.
 *
 * `present`는 마커 존재 여부(legacy 포함), `jobId`는 resume-poll 가능한 값
 * (마커가 없거나 legacy 값 `'1'`이면 null)이다. 호출부는 세 상태를 모두
 * 구분해야 한다: jobId 있음(poll 재개) / present만 true(이번 tick엔 skip,
 * TTL 만료 대기) / present도 false(신규 submit).
 */
export async function getInFlightMarker(
    symbol: string,
    tab: string
): Promise<{ present: boolean; jobId: string | null }> {
    const redis = getRedisClient();
    if (redis === null) return { present: false, jobId: null };
    const value = await redis.get<string>(
        `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`
    );
    if (value === null) return { present: false, jobId: null };
    if (value === '1') return { present: true, jobId: null };
    return { present: true, jobId: String(value) };
}

/** in-flight 마커를 즉시 제거한다(FIX Z) — job이 done/error로 확정되면 다음 tick이
 * 만료(최대 30min)를 기다리지 않고 바로 최신 상태(fresh 또는 backoff)를 반영하게 한다. */
export async function clearInFlight(
    symbol: string,
    tab: string
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.del(`seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`);
}

/** (symbol, tab) 조합을 terminal-skip(backoff) 상태로 마킹한다(FIX C, TTL 6h). */
export async function markSkipped(symbol: string, tab: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.set(`seo-prewarm:skip:${symbol.toUpperCase()}:${tab}`, '1', {
        ex: SKIP_TTL_SECONDS,
    });
}

/** (symbol, tab) 조합이 현재 backoff(skip) 상태인지 조회한다(FIX C). */
export async function isSkipped(symbol: string, tab: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    return (
        (await redis.get(`seo-prewarm:skip:${symbol.toUpperCase()}:${tab}`)) !==
        null
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
