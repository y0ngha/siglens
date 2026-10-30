import { AI_SITE_URL } from '@/shared/config/aiHost';
import {
    isApiPath,
    localePath,
    splitLocalePath,
    type Locale,
} from '@/shared/i18n/locales';
import {
    PARSE_ONLY_BASE,
    sanitizeNextPath,
    toSameOriginPath,
} from '@/shared/lib/auth/redirect';

/**
 * 신뢰할 수 없는 `next`를 같은 사이트의 로케일 포함 ai 경로로 바꾸는 유일한 경로다.
 * 핸드오프 라우트(start·issue·consume 성공)가 모두 이 함수를 거친다.
 *
 * - sanitize → 같은 출처 경로로 파싱 → 로케일 분리 → `localePath`. `localePath`는
 *   `//`·`/\`를 절대 만들지 않는다(왕복 변환 구멍은 그 JSDoc 참고).
 * - `next` 자체가 `/api` 경로(예: 다른 `/api/auth/handoff/start?next=…`)면 로케일 루트로
 *   바꾼다 — 따라가면 핸드오프가 연쇄되어 홉마다 세션이 하나씩 생긴다.
 */
export function resolveHandoffNext(raw: string | null | undefined): {
    locale: Locale;
    next: string;
} {
    const { locale, path } = splitLocalePath(
        toSameOriginPath(sanitizeNextPath(raw))
    );
    const localized = localePath(locale, path);
    return {
        locale,
        next: isApiPath(localized) ? localePath(locale, '/') : localized,
    };
}

/**
 * 핸드오프 첫 홉(ai 호스트의 `/api/auth/handoff/start?next=…`) URL.
 * 출처는 입력과 무관하게 항상 `AI_SITE_URL` 상수다.
 */
export function handoffStartUrl(raw: string | null | undefined): URL {
    const { locale, next } = resolveHandoffNext(raw);
    const start = new URL(
        localePath(locale, '/api/auth/handoff/start'),
        AI_SITE_URL
    );
    start.searchParams.set('next', next);
    return start;
}

const HANDOFF_ISSUE_PATH = '/api/auth/handoff';

/**
 * Server Action이 로그인/가입 직후 `redirect()`할 대상을 고른다. 대상이 SSO
 * 핸드오프 발급 경로(`/api/auth/handoff?to=ai&next=…`)면 그 라우트가 state 없는
 * 요청에 돌려줄 ai 호스트 start URL(절대 URL)로 바꾸고, 아니면 그대로 돌려준다.
 *
 * 왜 필요한가 — Server Action의 **같은-호스트** `redirect()`는 브라우저 이동이
 * 아니다. Next.js가 서버 안에서 그 URL을 `RSC: 1` 헤더와 방금 심은 세션 쿠키를
 * 실어 fetch하고(302를 따라감), 받은 Flight 응답을 클라이언트 라우터가 SPA로
 * 적용한다. 핸드오프 라우트는 ai 호스트로 302 체인(start → issue → consume)을
 * 타므로 그 체인이 **서버 fetch 안에서** 소진된다 — ai 호스트의 state 쿠키는
 * 브라우저에 심기지 않고, 끝에 도착한 ai 페이지(`?sso=none`)의 RSC가 메인
 * 호스트 URL에 적용된다. 결과: 이메일 로그인은 성공하지만 ai.siglens.io로
 * 돌아가지 않는다. (OAuth는 콜백이 Route Handler라 진짜 302로 이동해서 멀쩡했다.)
 *
 * 다른 호스트의 절대 URL은 Next.js가 외부 리다이렉트로 취급해 서버 fetch 없이
 * 클라이언트가 `location.assign`으로 하드 내비게이션한다. start부터 시작하면
 * 발급 라우트가 어차피 하던 바운스(`handoff/route.ts`)를 한 홉 앞당길 뿐이다.
 */
export function toHandoffAwareRedirect(target: string): string {
    const url = new URL(target, PARSE_ONLY_BASE);
    if (
        url.origin !== PARSE_ONLY_BASE ||
        url.pathname !== HANDOFF_ISSUE_PATH ||
        url.searchParams.get('to') !== 'ai'
    ) {
        return target;
    }
    return handoffStartUrl(url.searchParams.get('next')).href;
}

/**
 * 로그아웃한 ai 방문자의 도착 URL. `?sso=none`이 핸드오프가 다시 로그인시키는 것을 막는다.
 */
export function aiSignedOutUrl(locale: Locale): URL {
    const url = new URL(localePath(locale, '/'), AI_SITE_URL);
    url.searchParams.set('sso', 'none');
    return url;
}
