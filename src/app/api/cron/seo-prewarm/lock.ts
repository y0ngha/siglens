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
// 2026-08 감사(KR 5종목 prewarm 미도달) — 회전 커서. TTL을 두지 않는다: 값 자체가 단조 증가하는
// 카운터일 뿐이라(문자열 하나) 만료시켜 청소해야 할 이유가 없고, cron이 몇 달
// 쉬어도 다음 실행이 그 값을 그대로 이어받는 편이 "왜 갑자기 오프셋이 0으로
// 리셋됐지"보다 낫다.
const ROTATION_CURSOR_KEY = 'seo-prewarm:rotation-cursor';
// FIX C(감사) — terminal skip(error/miss_no_trigger/no_trades/no_chains_error/null)
// 상태의 (symbol, tab)에 6h backoff를 건다. 5분 tick 기준 그대로 두면 하룻밤에
// ~96회 재시도되며 head 슬롯을 영구 점유한다 — 6h TTL이면 하룻밤에 최대 ~2회로 줄어든다.
const SKIP_TTL_SECONDS = 21600; // 6h

/**
 * 일시적 실패(프로바이더 장애·타임아웃·FMP fetch 실패)의 backoff TTL.
 *
 * 기본 6시간은 "이 유닛은 구조적으로 못 만든다"(옵션 체인 없는 심볼의 options 탭 등)에
 * 맞춘 값이다. 장애는 성격이 다르다 — 장애 중엔 **모든** 유닛이 동시에 실패하므로
 * 6시간을 걸면 20분짜리 FMP 장애가 그날 밤 prewarm을 통째로 날린다(야간 창이 7.5시간).
 */
export const TRANSIENT_SKIP_TTL_SECONDS = 1800; // 30min

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

/**
 * (symbol, tab) 조합을 skip(backoff) 상태로 마킹한다(FIX C).
 *
 * 기본 TTL은 6시간 — "이 유닛은 구조적으로 못 만든다"(옵션 체인 없는 심볼의 options
 * 탭 등)에 맞춘 값이다. 프로바이더 장애처럼 **일시적인** 실패에는 짧은 TTL을 넘겨야
 * 한다: 20분짜리 장애가 전 유닛에 6시간 마커를 남기면 프로바이더가 회복된 뒤에도
 * prewarm이 반나절 멈춘다.
 */
export async function markSkipped(
    symbol: string,
    tab: string,
    ttlSeconds: number = SKIP_TTL_SECONDS
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.set(`seo-prewarm:skip:${symbol.toUpperCase()}:${tab}`, '1', {
        ex: ttlSeconds,
    });
}

/**
 * "이 유닛은 **영원히** 못 만든다"로 확정된 `(symbol, tab)` 집합.
 *
 * backoff 마커(`markSkipped`)와 다르다. 저쪽은 "지금은 못 만든다"라 TTL이 지나면
 * 다시 후보가 되지만, 이쪽은 데이터가 구조적으로 존재하지 않는 조합이다 — 의회
 * 거래가 없는 종목의 `congress`, 옵션 체인이 없는 종목의 `options`.
 *
 * **왜 필요한가**: `runPrewarmBatch`의 stale 판정은 "탭 하나라도 fresh가 아니면
 * 그 심볼은 stale"이고, `resolveHarvest`는 `cached`/`done`일 때만 스냅샷 행을
 * 쓴다. 즉 만들 수 없는 탭은 행이 영원히 안 생기고, `generatedAtMap`에 키가 없어
 * 영구히 not-fresh이며, 그 심볼은 **영구 stale**이 된다. 2026-08-30 실측에서
 * `staleTotal`이 113에 고정된 채 `harvested: 0`이 8시간 이어졌고, 그 113개는
 * 나머지 탭이 전부 fresh인데 `congress` 하나 때문에 매 회전마다 배치 슬롯을
 * 소진하고 있었다. starvation watch도 `ALAB(never)`처럼 6탭이 멀쩡한 심볼을
 * 미도달로 잘못 지목했다.
 *
 * 집합(SET) 하나에 모아 두는 것이 핵심이다 — 배치당 `SMEMBERS` **1회**로 전부
 * 읽으므로, stale 판정이 지켜 온 "DB 1회 + 심볼별 Redis 왕복 없음" 성질을 깨지
 * 않는다. 심볼별 키였다면 유니버스 크기만큼 왕복이 늘어난다.
 *
 * TTL을 두지 않는다. 상장 폐지·옵션 상장 같은 변화로 낡을 수는 있지만, 그때는
 * 해당 조합이 유니버스에서 사라지거나 `clearStructurallyUnavailable`로 지운다 —
 * 만료로 되살리면 "6시간마다 되살아나 슬롯을 먹는" 지금 문제로 그대로 돌아간다.
 */
const STRUCTURAL_SET_KEY = 'seo-prewarm:structural-unavailable';

function structuralMember(symbol: string, tab: string): string {
    return `${symbol.toUpperCase()}:${tab}`;
}

/** `(symbol, tab)`을 구조적 불가로 확정한다. 멱등이다(SADD). */
export async function markStructurallyUnavailable(
    symbol: string,
    tab: string
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.sadd(STRUCTURAL_SET_KEY, structuralMember(symbol, tab));
}

/** 확정을 해제한다 — 옵션이 새로 상장되는 등 구조가 바뀐 조합의 복구용. */
export async function clearStructurallyUnavailable(
    symbol: string,
    tab: string
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    await redis.srem(STRUCTURAL_SET_KEY, structuralMember(symbol, tab));
}

/**
 * 구조적 불가 조합 전체를 한 번에 읽는다(배치당 1회).
 *
 * redis 미구성이면 빈 집합을 준다 — 그 경우 동작은 이 수정 이전과 동일해질 뿐
 * (만들 수 없는 탭이 다시 stale로 잡힘) 배치가 죽지는 않는다. `markSkipped` 등
 * 다른 마커 함수들과 같은 degrade 방침이다.
 */
export async function loadStructurallyUnavailable(): Promise<Set<string>> {
    const redis = getRedisClient();
    if (redis === null) return new Set();
    const members = await redis.smembers(STRUCTURAL_SET_KEY);
    return new Set(members.map(String));
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

/**
 * 예산 버킷은 **ET 날짜**다. prewarm 창(20:30~03:59 UTC)이 UTC 자정을 가로지르기 때문에
 * UTC 날짜로 버킷을 잡으면 하룻밤이 항상 두 키로 쪼개진다 — 각 키가 예산 상한을 따로
 * 세므로 실제로는 상한의 두 배까지 FMP를 호출할 수 있다. ET 기준으로는 창 전체가
 * 16:30~23:59 ET 한 날짜 안에 들어간다.
 *
 * `en-CA`는 `YYYY-MM-DD`를 낸다.
 */
function fmpBudgetKey(now = new Date()): string {
    const etDate = now.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
    });
    return `seo-prewarm:fmp-budget:${etDate}`;
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

/**
 * 회전 커서를 `step`만큼 원자적으로 전진시키고, 전진 **전** 값(=이번 tick이 쓸
 * 오프셋)을 반환한다(`runPrewarmBatch.ts`의 `selectFairBatch`).
 *
 * 2026-08 감사(KR 5종목 prewarm 미도달) — 이전 구현은 오프셋을
 * `floor(now / TICK_ROTATION_MS) * SYMBOLS_PER_TICK`으로 **시각**에서 파생했다.
 * 배치 하나가 지연되면(FMP 폭풍 등) 다음 실제 실행 시각이 몇 틱씩 밀리고, 그만큼
 * 오프셋이 한 번에 점프해(walk이 아니라 jump) 후보 창 폭을 넘으면 그 구간이 그
 * 날 밤 영영 후보가 되지 못했다 — `BATCH_DEADLINE_MS + 스케줄주기 ≤ 창 폭`이라는
 * 불변식이 "정확히 경계"였기 때문에 아주 작은 추가 지연도 그 구멍을 열 수 있었다.
 *
 * 대신 오프셋을 Redis에 절대값(모듈로 없이 계속 커지는 카운터)으로 들고, **실제
 * 배치 실행 1회당** `step`(=SYMBOLS_PER_TICK)만큼만 전진시킨다 — 경과 시각이
 * 아니라 "실행 횟수"에 묶는다. 그 결과:
 * - **skip 불가**: 다음 실행이 아무리 늦게 일어나도(락 때문에 몇 틱을 건너뛰어도)
 *   전진 폭은 항상 `step` 하나뿐이다 — 이전 창과 바로 이어 붙으므로 구간이 비지
 *   않는다.
 * - **livelock 불가**(2026-07-26 인시던트 재발 방지): 창 안 후보가 전부
 *   blocked라도 전진은 "완료 여부"가 아니라 "시도 여부"에 걸려 있어 무조건
 *   일어난다 — `selectFairBatch`가 분류 결과와 무관하게 매 호출마다 이 함수를
 *   한 번 부른다.
 *
 * INCRBY 한 번으로 읽기+쓰기를 원자적으로 합친다(락이 이미 실행을 직렬화하므로
 * 굳이 필요하진 않지만, 락 밖에서 호출될 가능성에도 안전하다). 새 값에서 `step`을
 * 빼면 "이번 tick 시작 시점"의 값이 된다 — INCRBY는 키가 없으면 0에서 시작하므로
 * 최초 실행은 자연스럽게 오프셋 0에서 시작하고(과거 `slice(0, N)` 버그처럼 영구히
 * 0에 머무는 게 아니라 매 실행마다 전진하므로 재발하지 않는다), 커서 키가 유실돼도
 * (Redis 마이그레이션 등) 0으로 재시작할 뿐 자체 치유된다.
 *
 * ⚠️ 다른 lock.ts 함수들과 달리 redis가 null이어도 조용히 기본값을 반환하지
 * **않는다**(`getFmpBudgetUsed` 등과 다른 이유는 아래 참고). 단, 이 null 체크가
 * 잡는 건 정확히 **"redis 미구성"** 한 가지뿐이다 — `getRedisClient()`는 env
 * 존재 여부로 키를 잡는 캐시된 싱글톤이고, 이 함수는 `acquirePrewarmLock()`이
 * 이미 non-null 클라이언트를 얻은 뒤에만 실행되므로(`runPrewarmBatch`는
 * `route.ts`에서 락 획득 성공 후에만 호출된다), 실행 시점에 redis가 미구성일
 * 가능성은 사실상 없다 — 그럼에도 null이 온다면 lock.ts와 이 함수 사이 다른
 * 곳에서 클라이언트 설정이 깨졌다는 신호라, 조용히 0을 반환해 오프셋을 매번
 * 창의 시작으로 되돌리는 것보다 배치를 fail-loud로 실패시켜 `batch failed`
 * 알람이 뜨는 편이 안전하다.
 *
 * **이 null 체크가 못 잡는 것**: redis가 구성돼 있는데 `redis.incrby` 호출
 * 자체가 REJECT하는 진짜 Upstash 네트워크 장애·타임아웃. null 체크는 클라이언트
 * *존재 여부*만 보므로 이 경우는 애초에 검사 대상이 아니다 — throw가 그대로
 * 전파된다. 다만 이건 이 함수만의 사정이 아니라 이 경로(selectFairBatch →
 * classifySymbol의 `getInFlightMarker`/`isSkipped`, `Promise.all`로 후보별
 * 격리 없이 호출됨) 전체가 오늘 공유하는 상태다 — 후보 하나의 Redis 호출이
 * reject하면 `Promise.all` 전체가 reject해 같은 방식으로 배치가 실패한다.
 * 결과는 동일하게 fail-hard: 그 tick의 배치가 실패하고(`route.ts`의 `catch`가
 * `[seo-prewarm] batch failed:`로 로그), `finally`가 락을 해제하며, 다음
 * EventBridge tick(5분 뒤)이 재시도한다. 후보 단위 격리(개별 Redis 호출 실패가
 * 배치 전체를 죽이지 않게 하는 것)는 아직 없다 — 별도 작업 대상이다.
 */
export async function advanceRotationCursor(step: number): Promise<number> {
    const redis = getRedisClient();
    if (redis === null) {
        throw new Error(
            '[seo-prewarm] redis unavailable — cannot advance rotation cursor'
        );
    }
    const next = await redis.incrby(ROTATION_CURSOR_KEY, step);
    return next - step;
}
