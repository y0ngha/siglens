import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';

/**
 * `/login?error=<code>`의 코드를 `entities.auth` 메시지 키로 바꾼다. 쿼리는 누구나 만들 수 있는
 * 링크 값이라 표의 **자기 속성**만 인정한다 — 그냥 인덱싱하면 `constructor`·`toString` 같은
 * 프로토타입 이름이 함수로 풀려 번역기에 넘어가고, 로그인 폼 위에 깨진 문자열 배너가 뜬다.
 */
export function loginErrorKey(code: string | null): string | undefined {
    if (!code || !Object.hasOwn(AUTH_ERROR_KEY, code)) return undefined;
    return AUTH_ERROR_KEY[code];
}
