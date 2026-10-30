const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 쿠키로 들어온 값이 세션 id(`sessions.id`, Postgres `uuid`)로 쓸 수 있는 형태인지 검사한다.
 *
 * 세션 쿠키는 클라이언트가 임의 문자열로 바꿀 수 있다. 형식이 틀린 값을 그대로 쿼리에 바인딩하면
 * Postgres가 22P02(invalid input syntax for type uuid)를 던져 `getCurrentUser`가 거부되고,
 * 로그아웃도 쿠키를 지우지 못한 채 실패한다. 저장소는 이 검사를 먼저 해 "없는 세션"으로 취급한다.
 */
export function isSessionToken(value: string): boolean {
    return UUID_RE.test(value);
}
