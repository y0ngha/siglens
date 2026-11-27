import { describeDbErrorForLog } from '@/shared/db/describeDbErrorForLog';
import { isRecord } from '@/shared/lib/isRecord';

/** `cause` 체인을 따라가는 깊이 상한. 순환 `cause`도 여기서 끊긴다. */
const MAX_CHAIN_DEPTH = 8;

/** SQLSTATE 모양(`23505`, `42P01`, `P0001`, `XX000`). 드라이버 표지와 함께일 때만 센다. */
const SQLSTATE = /^[0-9A-Z]{5}$/;

const DRIZZLE_FAILED_QUERY = /^Failed query:/;

/** 에러를 읽다가 던졌을 때(깨진 getter, 폐기된 Proxy) 돌려주는 고정 문자열. */
const UNREADABLE = 'unreadable error';

/**
 * 드라이버가 직접 만든 에러의 표지: `PostgresError`(postgres.js)·`DatabaseError`(pg) 이름이거나 서버가 실은
 * `severity`·`routine`. 공급자 JSON 에러가 우연히 5자리 `code`를 가진 경우(`'10001'`)와 가르는 근거다.
 */
function hasDriverMarker(value: Record<string, unknown>): boolean {
    const { name, severity, routine } = value;
    return (
        name === 'PostgresError' ||
        name === 'DatabaseError' ||
        typeof severity === 'string' ||
        typeof routine === 'string'
    );
}

function isDatabaseErrorNode(value: Record<string, unknown>): boolean {
    const { constructor, name, message, code, query, params, parameters } =
        value;
    return (
        (typeof constructor === 'function' &&
            constructor.name === 'DrizzleQueryError') ||
        name === 'PostgresError' ||
        (typeof message === 'string' && DRIZZLE_FAILED_QUERY.test(message)) ||
        // drizzle은 `params`, postgres.js는 `parameters`에 바인딩 값을 싣는다.
        (typeof query === 'string' &&
            (params !== undefined || parameters !== undefined)) ||
        (typeof code === 'string' &&
            SQLSTATE.test(code) &&
            hasDriverMarker(value))
    );
}

function childrenOf(value: Record<string, unknown>): unknown[] {
    const { cause, errors } = value;
    return Array.isArray(errors) ? [cause, ...errors] : [cause];
}

function walk(error: unknown, depth: number): boolean {
    if (depth >= MAX_CHAIN_DEPTH || !isRecord(error)) return false;
    return (
        isDatabaseErrorNode(error) ||
        childrenOf(error).some(child => walk(child, depth + 1))
    );
}

/**
 * 에러나 그 `cause` 체인(`AggregateError.errors` 포함)에 데이터베이스 에러가 있는가. 읽는 도중 던지면 DB 에러로
 * 본다(fail closed): 못 읽는 에러의 메시지를 믿고 로그로 보낼 수 없다.
 */
export function isDatabaseError(error: unknown): boolean {
    try {
        return walk(error, 0);
    } catch {
        return true;
    }
}

function describeSafely(error: unknown): string {
    try {
        return describeDbErrorForLog(error);
    } catch {
        return UNREADABLE;
    }
}

/**
 * 로그(또는 저장·응답 본문)에 남길 에러 값. 데이터베이스 에러가 섞여 있으면 메시지·파라미터·스택 없이 이름과 에러
 * 코드만 남기고, 아니면 에러를 **그대로** 돌려준다.
 *
 * drizzle은 실패한 쿼리의 바인딩 파라미터를 에러 메시지에 넣는다(`Failed query: … params: …`). 세션 토큰
 * (세션 ID가 곧 쿠키 토큰이다), 비밀번호 해시, 이메일, 인증·재설정 토큰, API 키 해시, 보유종목, 채팅 내용이 파라미터다.
 * `console.error(tag, error)`는 그 값을 로그로 보낸다. 이 헬퍼가 그 한 줄을 막는다.
 *
 * DB 에러가 아닌 에러(공급자 fetch·LLM·Redis)는 메시지와 상태가 원인을 설명하므로 지우지 않는다. 그래서
 * `describeDbErrorForLog`(항상 이름·코드만)와 달리 "DB 에러일 때만" 지운다. DB 에러인지는 메시지를 믿지 않고
 * **구조**로 판정한다. `cause` 체인 어디에 있어도 감싼 에러 전체를 지운다. 바깥 에러를 출력할 때 Node가 `cause`의
 * 메시지까지 함께 찍기 때문이다. 이 함수는 던지지 않는다: `catch` 안에서 불리므로 읽기에 실패하면 고정 문자열을 준다.
 *
 * 한계: 에러 메시지를 새 문자열로 옮겨 담아 다시 던진 에러(`new Error(`x: ${err.message}`)`)는 구조가 사라져서
 * 알아볼 수 없다.
 */
export function redactDbErrorForLog(error: unknown): unknown {
    return isDatabaseError(error) ? describeSafely(error) : error;
}

/**
 * `redactDbErrorForLog`의 문자열판. 로그 인자나 DB 컬럼·응답 본문에 **메시지 문자열**을 싣는 자리에 쓴다.
 * DB 에러면 이름과 코드만, 아니면 `Error`의 `message`(그 밖의 값은 `String`)를 준다. 던지지 않는다.
 */
export function redactedErrorMessage(error: unknown): string {
    const safe = redactDbErrorForLog(error);
    try {
        return safe instanceof Error ? safe.message : String(safe);
    } catch {
        return UNREADABLE;
    }
}
