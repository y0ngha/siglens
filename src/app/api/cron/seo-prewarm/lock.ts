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

// FIX 3(감사, 실증) — legacy 마커의 job-agnostic sentinel. 과거엔 `'1'`을 썼는데,
// @upstash/redis의 기본 `parseResponse`가 모든 GET 응답에 `JSON.parse`를 돌려
// `'1'`처럼 유효한 JSON 리터럴은 **number** `1`로 역직렬화한다(원시 문자열
// `'pending'`은 유효 JSON이 아니라 JSON.parse가 throw → 원본 문자열 그대로
// 돌아온다 — @upstash/redis chunk-2X4SLXT7.mjs `parseRecursive`/`parseResponse`
// 참고). 그래서 `'pending'`을 새 sentinel로 쓰면 애초에 number 오염이 생기지
// 않는다. 다만 이미 저장돼 있던 옛 `'1'` 마커(역시 number로 돌아옴)도 계속
// job-agnostic으로 인식해야 하므로 `getInFlightMarker`는 두 sentinel을 모두 검사한다.
const INFLIGHT_JOB_AGNOSTIC_SENTINEL = 'pending';
const INFLIGHT_JOB_AGNOSTIC_LEGACY_SENTINEL = '1';

/**
 * (symbol, tab) 조합을 in-flight로 마킹해 중복 submit을 막는다.
 *
 * run* 함수는 블로킹으로 결과를 반환하므로 jobId 추적이 필요 없다.
 * 마커는 "진행 중 — 이 tick엔 재제출 금지"를 나타내는 단순 플래그다.
 * TTL(30min) 만료 후 다음 tick이 새로 submit한다.
 */
export async function markInFlight(symbol: string, tab: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.set(
        `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`,
        INFLIGHT_JOB_AGNOSTIC_SENTINEL,
        {
            ex: INFLIGHT_TTL_SECONDS,
        }
    );
}

/**
 * (symbol, tab) 마커 상태를 단일 Redis GET으로 조회한다(FIX 1, 감사 PR #698
 * 리뷰). 이전엔 `isInFlight`(마커 존재?)와 `getInFlightJobId`(resumable
 * jobId?)가 별도 함수였는데, `isInFlight`는 프로덕션 어디서도 호출되지 않는
 * 죽은 코드였고 `getInFlightJobId`만 쓰였다. 그 결과 job-agnostic 마커(jobId
 * 없이 `markInFlight`된 경우 — 예: `overall`의 `pending_dependencies`)가 있는
 * (symbol, tab)도 `getInFlightJobId`가 null을 반환해 "in-flight 아님"으로
 * 오판되어 매 5분 tick마다 재제출됐다(FMP 예산 재계상 포함) — `markInFlight`의
 * 문서화된 의도("재개 불가, 자연 TTL 만료 후 재시도")와 정면으로 어긋났다.
 *
 * FIX 3(감사, 실증) — 그 "FIX 1" 자체가 실전에서 죽어 있었다: `markInFlight`가
 * jobId 없이 저장한 sentinel(`'1'`)을 여기서 `value === '1'`로 비교했는데,
 * @upstash/redis의 기본 `automaticDeserialization`이 GET 응답에 `JSON.parse`를
 * 돌려 `'1'`을 **number** `1`로 반환한다(실 REST 라운드트립으로 확인 —
 * `redis.get<string>('...')`의 타입 파라미터는 컴파일 타임 캐스트일 뿐 런타임
 * 값을 바꾸지 않는다). `1 === '1'`은 항상 false라 이 분기가 프로덕션에서 단
 * 한 번도 타지 않았고, 모든 job-agnostic 마커가 `jobId: '1'`(String(1))로
 * 오인식돼 존재하지 않는 job을 poll하다 실패 → terminal skip → 6h backoff로
 * 이어졌다(의도한 30분 TTL 대기 대신). `String(value)`로 먼저 정규화한 뒤
 * sentinel 비교해야 문자열/숫자 어느 쪽으로 오든 안전하다 — "단순화"해서
 * 되돌리지 말 것.
 *
 * `present`는 마커 존재 여부(job-agnostic 포함), `jobId`는 resume-poll 가능한
 * 값(마커가 없거나 job-agnostic sentinel이면 null)이다. 호출부는 세 상태를
 * 모두 구분해야 한다: jobId 있음(poll 재개) / present만 true(이번 tick엔
 * skip, TTL 만료 대기) / present도 false(신규 submit).
 */
/**
 * (symbol, tab) 마커 존재 여부를 단일 Redis GET으로 조회한다.
 *
 * FIX 3(감사, 실증) — @upstash/redis의 기본 `automaticDeserialization`이 GET
 * 응답에 `JSON.parse`를 돌려 `'1'`을 number `1`로 반환한다. 비교 전 항상
 * `String(value)`로 정규화해야 sentinel 비교가 실제로 매치된다.
 * legacy sentinel(`'1'` → number `1`)도 계속 `present: true`로 인식한다.
 */
export async function getInFlightMarker(
    symbol: string,
    tab: string
): Promise<{ present: boolean }> {
    const redis = getRedisClient();
    if (redis === null) return { present: false };
    const value = await redis.get<string>(
        `seo-prewarm:inflight:${symbol.toUpperCase()}:${tab}`
    );
    if (value === null || value === undefined) {
        return { present: false };
    }
    const raw = String(value);
    if (
        raw === INFLIGHT_JOB_AGNOSTIC_SENTINEL ||
        raw === INFLIGHT_JOB_AGNOSTIC_LEGACY_SENTINEL
    ) {
        return { present: true };
    }
    // 구버전 코드가 저장한 임의 값(예: jobId 문자열)도 present로 취급한다.
    return { present: true };
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
