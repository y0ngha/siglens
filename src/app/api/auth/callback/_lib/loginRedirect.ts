import { NextResponse } from 'next/server';
import { getOAuthRedirectBaseUrl } from '@/features/auth-oauth/lib/providers';
import { expiredOAuthStateCookie } from '@/features/auth-oauth/lib/state';
import { localePath, splitLocalePath } from '@/shared/i18n/locales';
import {
    DEFAULT_REDIRECT_PATH,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';

/**
 * `/api/*`는 next-intl 매처에서 제외돼 있어(`proxy.ts`) 콜백 핸들러에는 로케일이
 * 없다. 그런데 여기서 리다이렉트하는 대상은 API 소비자가 아니라 **사용자가 볼
 * 앱 페이지**다. 로케일을 잃으면 `/en/login`에서 시작한 사용자가 OAuth 왕복 후
 * 한국어 페이지에 떨어진다.
 *
 * 로케일은 state에 실린 `next`에서 복원한다 — `LoginContent`/`SignupContent`가
 * 접두사를 붙여 넣기 때문이다. state 검증 전에 실패한 경우(`next` 없음)에만
 * 기본 로케일로 떨어지는데, 그건 애초에 복원할 근거가 없는 자리다.
 */
export function localeFromNext(
    next: string | undefined
): ReturnType<typeof splitLocalePath>['locale'] {
    return splitLocalePath(next).locale;
}

/**
 * OAuth 콜백 실패를 로그인 화면의 `?error=` 코드로 돌려보내고 state 쿠키를 지운다.
 * `next`는 `sanitizeNextPath`를 거쳐 기본 경로가 아닐 때만 실어 준다.
 */
export function redirectToLoginWithError(
    code: string,
    email?: string,
    next?: string
): NextResponse {
    const url = new URL(
        localePath(localeFromNext(next), '/login'),
        getOAuthRedirectBaseUrl()
    );
    url.searchParams.set('error', code);
    if (email) url.searchParams.set('email', email);
    // 돌아갈 곳을 로그인 화면에 되실어 준다 — 없으면 ai.siglens.io에서 온 사용자가
    // (SSO 핸드오프 `next`) 이메일로 다시 로그인한 뒤 메인 홈에 남는다.
    const safeNext = sanitizeNextPath(next);
    if (safeNext !== DEFAULT_REDIRECT_PATH)
        url.searchParams.set('next', safeNext);
    const response = NextResponse.redirect(url);
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}
