/**
 * 동의 페이지 `?token=` 쿼리를 대기 중 가입 토큰으로 읽는다. Next는 같은 키가 여러 번 오면 배열을
 * 넘기므로(`?token=a&token=b`) 문자열 하나일 때만 인정한다 — 배열을 그대로 스토어에 넘기면
 * `"a,b"` 키를 조회해 "만료" 안내로 잘못 끝난다.
 */
export function readConsentToken(
    token: string | string[] | undefined
): string | null {
    return typeof token === 'string' && token.length > 0 ? token : null;
}
