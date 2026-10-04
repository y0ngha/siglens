import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

/**
 * `document.cookie`에서 힌트 쿠키(`siglens_auth`, non-httpOnly)가 값과 함께 있는지 읽는다.
 *
 * **브라우저 전용이다.** 렌더 중에 부르면 서버·하이드레이션 결과가 갈리므로, 렌더에서
 * 필요하면 `useAuthHint`(하이드레이션 뒤에만 읽는다)를 쓰고 이 함수는 이벤트 핸들러에서만
 * 직접 부른다. 값이 비어 있으면(로그아웃 clear) false.
 *
 * 인증의 근거가 아니다 — 세션이 죽었는데 힌트만 남을 수 있다. 낙관적 추정에만 쓴다.
 */
export function readAuthHintCookie(): boolean {
    const prefix = `${AUTH_HINT_COOKIE_NAME}=`;
    // `;`로만 분할 후 각 항목을 trim — 브라우저별로 `; ` 구분자 뒤 공백이 0개거나 여러 개일 수 있다.
    const entry = document.cookie
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith(prefix));
    return !!entry && entry.slice(prefix.length).length > 0;
}
