import postgres from 'postgres';
import type { WithRetryOptions } from '@/shared/lib/withRetry';

/**
 * 일시적(transient) 서버측 SQLSTATE — 커넥션 수명주기·용량 고갈 계열.
 * `PostgresError.code`에 실려 오는 값만 이 집합으로 판정한다.
 *
 *   - 57P01: admin_shutdown (Neon/RDS 컴퓨트가 내려가거나 pooler가 줄어드는 중)
 *   - 57P02: crash_shutdown (서버 크래시 후 재시작 중)
 *   - 57P03: cannot_connect_now (기동·복구·장애조치 중이라 아직 접속을 받지 못함)
 *   - 08000: connection_exception
 *   - 08006: connection_failure
 *   - 08003: connection_does_not_exist
 *   - 08001: sqlclient_unable_to_establish_sqlconnection
 *   - 08004: sqlserver_rejected_establishment_of_sqlconnection
 *   - 53300: too_many_connections (일시적 상한; backoff 후 재시도 안전)
 */
const TRANSIENT_SQLSTATES = new Set<string>([
    '57P01',
    '57P02',
    '57P03',
    '08000',
    '08006',
    '08003',
    '08001',
    '08004',
    '53300',
]);

/**
 * 서버까지 가지 못했거나 소켓이 끊긴 클라이언트측 에러 코드.
 *
 * - `CONNECTION_*`, `CONNECT_TIMEOUT`: postgres-js가 직접 만드는 코드
 *   (`node_modules/postgres/src/errors.js`의 `Errors.connection`).
 * - `ECONNRESET`/`ECONNREFUSED`/`ETIMEDOUT`/`EPIPE`/`EAI_AGAIN`/`ENETUNREACH`/`EHOSTUNREACH`: node 소켓·DNS가
 *   그대로 올려 주는 errno 코드. 유휴 커넥션을 서버(Neon pooler, RDS 장애조치)가
 *   끊은 뒤 풀이 그 소켓에 쓰는 경우 `EPIPE`/`ECONNRESET`/`CONNECTION_CLOSED`로 나온다.
 *
 * SQLSTATE와 문자열 공간이 겹치지 않으므로(5자리 vs 식별자) 한 번의 `code` 조회로
 * 둘을 구분해도 오탐이 없다.
 */
const TRANSIENT_CONNECTION_CODES = new Set<string>([
    'CONNECTION_CLOSED',
    'CONNECTION_ENDED',
    'CONNECTION_DESTROYED',
    'CONNECT_TIMEOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
    'ENETUNREACH',
    'EHOSTUNREACH',
]);

/**
 * 따라갈 `cause` 링크 상한. drizzle은 드라이버 에러를 `Failed query: …` Error 하나로
 * 감싸므로 실제로는 1~2단이면 충분하다 — 순환 참조 `cause`를 끊기 위한 안전장치다.
 */
const MAX_CAUSE_DEPTH = 8;

function readCode(error: Error): string | undefined {
    // 안전한 캐스트 근거: `code`는 postgres-js·node 소켓 에러가 얹는 선택 필드이고,
    // 바로 아래에서 `typeof === 'string'`으로 좁히므로 없거나 비문자열이면 undefined다.
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
}

function isPostgresError(error: Error): boolean {
    // `instanceof`가 1차 신호. `name` 비교는 모듈 인스턴스가 둘로 갈라진 경우(번들이
    // 클래스 정체성을 바꾸는 경우)를 위한 보강이다.
    return (
        error instanceof postgres.PostgresError ||
        error.name === 'PostgresError'
    );
}

function looksTransient(error: Error): boolean {
    const code = readCode(error);
    if (code === undefined) return false;
    if (isPostgresError(error)) return TRANSIENT_SQLSTATES.has(code);
    return TRANSIENT_CONNECTION_CODES.has(code);
}

/**
 * `cause` 체인을 따라가며 일시적 DB 에러(postgres-js `PostgresError`의 일시 SQLSTATE,
 * 또는 연결 계열 에러 코드)를 찾는다. drizzle은 원 에러를 `Failed query: …` Error의
 * `cause`에 넣으므로 바깥 에러만 보면 실제 일시 장애를 전부 놓친다.
 */
export function isTransientDbError(error: unknown): boolean {
    let current: unknown = error;
    for (
        let depth = 0;
        depth < MAX_CAUSE_DEPTH && current instanceof Error;
        depth++
    ) {
        if (looksTransient(current)) return true;
        current = current.cause;
    }
    return false;
}

/**
 * DB 쓰기 경로 공통 재시도 정책. 200/400/800ms 지수 backoff + jitter로 3회 재시도해
 * 전형적인 일시 장애 구간(풀이 끊긴 소켓을 재연결하는 동안)을 흡수한다.
 *
 * `backoffBudgetMs: 5000`은 누적 backoff 대기 상한이다 — `fn()` 자체가 느려 경과
 * 시간이 5s에 가까워지면 더 잠들지 않고 포기한다. 최악의 대기는 약 2.8s
 * (200+400+800 + 최대 1× jitter)라 장수 서버에서 여유 있게 들어간다.
 *
 * 모든 `*Repository.upsert*` 호출부가 이 상수를 가져다 써서 재시도 동작을 균일하게 둔다.
 */
export const DB_TRANSIENT_RETRY: WithRetryOptions = {
    maxRetries: 3,
    baseDelayMs: 200,
    isRetryable: isTransientDbError,
    backoffBudgetMs: 5000,
};
