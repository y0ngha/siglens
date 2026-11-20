/**
 * 쓰기 실패 로그에 남길 문자열. 에러 이름과 데이터베이스 에러 코드(SQLSTATE 등)만 담는다.
 *
 * drizzle은 실패한 쿼리의 **파라미터를 에러 메시지에 그대로 넣는다**(`Failed query: … params: …`).
 * 방문·퍼널 기록의 파라미터는 방문자 해시, User-Agent 원문, 방문 경로, 구간값이라 메시지를 로그에 남기면
 * 비콘마다 그 값이 로그로 샌다. 그래서 메시지·파라미터·스택은 쓰지 않고 `cause` 체인의 `code`만 읽는다.
 */
const MAX_CAUSE_DEPTH = 8;

export function describeDbErrorForLog(error: unknown): string {
    const name = error instanceof Error ? error.name : typeof error;
    const code = findCode(error);
    return `${name} code=${code ?? 'none'}`;
}

/** `cause` 체인을 깊이 상한까지만 따라가며 처음 나오는 문자열 `code`를 찾는다. 순환 `cause`는 상한에서 끊긴다. */
function findCode(error: unknown, depth = 0): string | undefined {
    if (depth >= MAX_CAUSE_DEPTH || !(error instanceof Error)) return undefined;
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === 'string' ? code : findCode(error.cause, depth + 1);
}
