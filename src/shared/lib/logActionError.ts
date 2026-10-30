import { readErrorCode } from '@/shared/lib/readErrorCode';

/**
 * 서버 액션 실패를 쿼리 내용 노출 없이 로깅한다. `DrizzleQueryError`의
 * `.message`에는 실패한 문장의 바인딩 파라미터(예: 채팅 대화의 원본 제목,
 * 포트폴리오 보유 종목 값)가 들어 있어 `error`를 그대로 찍으면 사용자 입력이
 * 서버 로그에 남는다. 안전한 진단 정보는 에러의 `name`과 드라이버가 싣는
 * SQLSTATE류 `code`뿐이다.
 *
 * `code`는 Drizzle이 감싼 에러면 `cause.code`, 감싸지 않은 postgres-js 에러나
 * Redis·fetch 소켓 에러(`ECONNRESET` 등)면 최상위 `code`에서 읽는다. 둘 다
 * 있으면 `cause.code`가 우선한다.
 */
export function logActionError(tag: string, error: unknown): void {
    const name = error instanceof Error ? error.name : 'unknown';
    console.error(tag, { name, code: readErrorCode(error) });
}
