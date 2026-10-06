import 'server-only';
import { Redis } from '@upstash/redis';
import {
    isOfflineBuild,
    warnOfflineBuildOnce,
    OFFLINE_BUILD_SERVICE,
} from '@/shared/api/offlineBuild';
import { isBatchWork } from '@/shared/lib/renderBudget';

export interface RedisClientPair {
    writer: Redis;
    reader: Redis;
}

interface UpstashEnv {
    url: string;
    token: string;
    /** Read-only token; null when the env var is unset or empty (no separate reader created). */
    readonlyToken: string | null;
}

/**
 * Upstash 명령 하나에 거는 상한(ms) — 요청 경로(렌더·서버 액션·라우트) 클라이언트용.
 * 재시도까지 **합친** 시간이다 — `signal` 함수는 요청(파이프라인)마다 한 번 호출되고 그
 * signal이 모든 재시도에 걸린다(`@upstash/redis` `HttpClient.request`).
 *
 * 왜 필요한가: 패키지 기본값은 timeout 없음 + 네트워크 오류 5회 재시도(지수 백오프 합 ~4.3초)다.
 * Upstash가 응답을 붙잡으면 undici 기본 헤더 timeout(300초)까지 명령이 매달리고, 렌더 경로의
 * `getOrSetCache`(봉·재무·프로필 read-through)를 쓰는 ISR 렌더도 같이 멈춘다(2026-10 서버 성능
 * 감사 M6). 같은 리전 Upstash 왕복은 수십 ms라 2초는 정상 트래픽을 자르지 않는다 — 렌더 중
 * 쓰기 경로(`upstashRenderSafeCommand.ts`)의 timeout과 같은 값이다.
 *
 * timeout이 나면 명령이 던지고, 호출부의 기존 장애 처리가 그대로 받는다:
 * `getOrSetCache`는 읽기 실패를 miss로 보고 원본을 직접 부르며 쓰기 실패는 삼킨다.
 *
 * 요청 경로 호출부별 timeout 동작(2026-10 PR #981 점검 — 모두 Redis 장애 때와 같은 분기다):
 * 공유 rate limit(`checkShareRateLimit`)·`createRedisSlot` 획득은 fail-open(통과), 플래그·마커·허브
 * 캐시는 "없음/no-op", handoff·OAuth 대기 가입·이메일 토큰의 발급/소비는 fail-closed(던져 사용자가
 * 재시도 — GETDEL이 서버에선 반영된 경우 코드가 소모돼 재발급이 필요하지만 재사용은 불가라 안전),
 * 챗 턴 락(`turnLock`)·prewarm 락은 fail-closed(server_busy / 이번 cron 건너뜀). 해로운 경우는 하나 —
 * 락 SET이 서버엔 반영됐는데 응답만 timeout이면 모르는 토큰의 락이 TTL 동안 남는다 — 그래서 두 락은
 * 획득 실패 시 같은 토큰으로 compare-and-delete를 한 번 시도한다(멱등).
 */
export const REDIS_COMMAND_TIMEOUT_MS = 2_000;

/**
 * 배치 작업(`runAsBatchWork` 안 — cron)용 명령 상한(ms). 배치는 응답을 기다리는 사람이 없고,
 * 한 명령이 큰 경우가 있다: seo-prewarm 락 획득·Lua 해제, IndexNow 대기열의 다건 `zrem`,
 * 정적 lastmod `hset`, cron 안의 `getOrSetCache` 대용량 쓰기(봉 blob). 2초로 자르면 Upstash가
 * 잠깐 느린 것만으로 이 작업들이 실패한다. 그래도 무한 대기는 막는다.
 *
 * 이 경로들은 timeout으로 끊겨도 재실행이 안전하다(멱등): 락 해제는 토큰 compare-and-delete라
 * 두 번 불러도 같고, 못 지운 락은 TTL로 풀린다. `zrem`은 이미 없는 멤버를 무시하고, 못 지운 URL은
 * 다음 tick에 다시 제출된다(IndexNow는 중복 제출에 무해). `hset`·캐시 쓰기는 같은 값 덮어쓰기다.
 */
export const REDIS_LONG_COMMAND_TIMEOUT_MS = 10_000;

/**
 * 네트워크 오류 재시도 횟수(첫 시도 제외). 기본 5회 대신 1회 — 짧은 순단 하나는 넘기되,
 * 장애 중에 백오프를 쌓아 렌더를 붙잡지 않는다. 상한은 위 timeout이 함께 건다.
 */
const REDIS_NETWORK_RETRIES = 1;

/** 클라이언트에 timeout·재시도를 건다. */
function createRedis(url: string, token: string, timeoutMs: number): Redis {
    return new Redis({
        url,
        token,
        retry: { retries: REDIS_NETWORK_RETRIES },
        // 함수로 넘겨야 명령마다 새 signal이 생긴다. AbortSignal 하나를 넘기면 첫 timeout 뒤
        // 클라이언트의 모든 명령이 영원히 abort된다.
        signal: () => AbortSignal.timeout(timeoutMs),
    });
}

/**
 * timeout 프로필별 싱글턴. 요청 경로와 배치가 **클라이언트를 따로** 쓴다 — 한 클라이언트에서
 * signal만 바꾸면 자동 파이프라이닝이 두 컨텍스트의 명령을 한 요청으로 묶어, 먼저 온 쪽의
 * timeout이 다른 쪽 명령에 걸린다.
 */
interface ClientSet {
    // undefined = not yet initialized; null = env not configured (graceful fallback).
    writer: Redis | null | undefined;
    // No null state: once initialized, reader is always a Redis instance
    // (either the writer itself or a dedicated readonly client).
    reader: Redis | undefined;
}

const requestClients: ClientSet = { writer: undefined, reader: undefined };
const batchClients: ClientSet = { writer: undefined, reader: undefined };
let cachedEnv: UpstashEnv | null | undefined;

/** 호출 시점의 비동기 컨텍스트로 클라이언트 세트와 timeout을 고른다. */
function currentProfile(): { clients: ClientSet; timeoutMs: number } {
    return isBatchWork()
        ? { clients: batchClients, timeoutMs: REDIS_LONG_COMMAND_TIMEOUT_MS }
        : { clients: requestClients, timeoutMs: REDIS_COMMAND_TIMEOUT_MS };
}

function getUpstashEnv(): UpstashEnv | null {
    if (cachedEnv === undefined) cachedEnv = readUpstashEnv();
    return cachedEnv;
}

function readUpstashEnv(): UpstashEnv | null {
    // offline build 중엔 env가 실제로 설정돼 있어도(로컬 .env.local이 프로덕션
    // 자격증명을 담고 있으므로) 미설정인 것처럼 취급한다 — 이 결과가 cachedEnv로
    // 메모되므로 이 체크는 메모이제이션보다 먼저 실행돼야 한다.
    if (isOfflineBuild()) {
        warnOfflineBuildOnce(OFFLINE_BUILD_SERVICE.UPSTASH);
        return null;
    }
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    // Treat empty string as "unset" so a literal empty env var doesn't create a reader.
    const raw = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    const readonlyToken = raw === undefined || raw === '' ? null : raw;
    return { url, token, readonlyToken };
}

/**
 * Writer 자격증명(URL + 쓰기 토큰). 미설정·오프라인 빌드면 `null`.
 *
 * `@upstash/redis` 패키지는 전역 `fetch`로 요청하므로 정적(ISR) 렌더 안에서 쓰면 그
 * 렌더를 동적으로 바꾼다. 렌더 중 쓰기가 필요한 곳은 이 자격증명으로
 * {@link import('./upstashRenderSafeCommand').runUpstashCommandOutsideFetch}를 쓴다.
 */
export function getUpstashWriterCredentials(): {
    url: string;
    token: string;
} | null {
    const env = getUpstashEnv();
    return env ? { url: env.url, token: env.token } : null;
}

/**
 * The app's shared Upstash Redis writer client (singleton per timeout profile:
 * request paths get {@link REDIS_COMMAND_TIMEOUT_MS}, `runAsBatchWork` contexts
 * such as cron get {@link REDIS_LONG_COMMAND_TIMEOUT_MS}). Call it at use time,
 * not at module load, so the caller's context picks the profile.
 *
 * Returns `null` when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are
 * not set, so callers can degrade gracefully (cache miss / direct fetch) in
 * environments without Redis (local dev, tests).
 */
export function getRedisClient(): Redis | null {
    const { clients, timeoutMs } = currentProfile();
    if (clients.writer !== undefined) return clients.writer;
    const env = getUpstashEnv();
    clients.writer = env ? createRedis(env.url, env.token, timeoutMs) : null;
    return clients.writer;
}

/**
 * Writer + reader pair (singleton per timeout profile). When
 * `UPSTASH_REDIS_REST_READONLY_TOKEN` is set, `reader` uses the read-only token;
 * otherwise `reader === writer`. The `writer` is the same instance returned by
 * {@link getRedisClient} in the same context. Returns `null` when Redis env is
 * not configured.
 */
export function getRedisReaderWriter(): RedisClientPair | null {
    const writer = getRedisClient();
    if (writer === null) return null;
    const { clients, timeoutMs } = currentProfile();
    if (clients.reader === undefined) {
        // writer is non-null here, so getUpstashEnv() is also non-null.
        const env = getUpstashEnv()!;
        clients.reader =
            env.readonlyToken !== null
                ? createRedis(env.url, env.readonlyToken, timeoutMs)
                : writer;
    }
    return { writer, reader: clients.reader };
}

/** Reset the cached singletons between test runs. */
export function __resetRedisClientForTests(): void {
    for (const clients of [requestClients, batchClients]) {
        clients.writer = undefined;
        clients.reader = undefined;
    }
    cachedEnv = undefined;
}
