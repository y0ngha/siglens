import { isRecord } from '@/shared/lib/isRecord';

function readStringCode(value: unknown): string | undefined {
    if (!isRecord(value)) return undefined;
    return typeof value.code === 'string' ? value.code : undefined;
}

/**
 * 던져진 값에서 로그에 남겨도 안전한 드라이버 `code`(SQLSTATE·`ECONNRESET` 등)를 읽는다.
 *
 * Drizzle이 감싼 에러면 `cause.code`, 감싸지 않은 postgres-js 에러나 Redis·fetch 소켓
 * 에러면 최상위 `code`에서 읽는다. 둘 다 있으면 `cause.code`가 우선하고, 문자열이
 * 아니면 없는 것으로 본다. 서버 액션 로그(`logActionError`)와 에이전트 도구 로그
 * (`safeErrorFields`)가 같은 규칙으로 읽도록 한곳에 둔다.
 */
export function readErrorCode(error: unknown): string | undefined {
    return (
        readStringCode(isRecord(error) ? error.cause : undefined) ??
        readStringCode(error)
    );
}
