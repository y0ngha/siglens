import { FUNNEL_SIGNUP_COOKIE_NAME } from '@/shared/config/cookieNames';
import {
    SIGNUP_CONVERSION_COOKIE_DOMAIN,
    SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
} from '@/shared/config/googleAds';
import { isOneOf, SIGNUP_METHODS, type SignupMethod } from './funnelEvents';

export interface FunnelSignupCookie {
    name: string;
    value: SignupMethod;
    maxAge: number;
    path: string;
    domain: string;
    sameSite: 'lax';
    secure: boolean;
    httpOnly: false;
}

/**
 * 가입 액션(`registerAction`·`finalizeOAuthSignupAction`)이 세팅하는 1회용 플래그.
 * 다음 페이지의 `FunnelSignupPing`이 읽고 지워야 하므로 httpOnly가 아니다. 도메인·수명은
 * Google Ads 가입 플래그와 같다 — ai.siglens.io에서 시작한 가입이 메인 호스트에서 끝나고
 * 핸드오프로 돌아가므로 상위 도메인이어야 ai 쪽 첫 페이지가 읽는다.
 */
export function createFunnelSignupCookie(params: {
    method: SignupMethod;
    secure: boolean;
}): FunnelSignupCookie {
    return {
        name: FUNNEL_SIGNUP_COOKIE_NAME,
        value: params.method,
        maxAge: SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
        path: '/',
        domain: SIGNUP_CONVERSION_COOKIE_DOMAIN,
        sameSite: 'lax',
        secure: params.secure,
        httpOnly: false,
    };
}

/**
 * 가입 플래그가 있으면 지우고 가입 방식을 돌려준다. 세팅할 때와 같은 Domain·Path로
 * 만료시켜야 지워진다. 값이 카탈로그 밖이면 지우되 null — 조작된 값은 기록하지 않는다.
 */
export function consumeFunnelSignupCookie(): SignupMethod | null {
    if (typeof document === 'undefined') return null;
    const prefix = `${FUNNEL_SIGNUP_COOKIE_NAME}=`;
    const entry = document.cookie
        .split('; ')
        .find(part => part.startsWith(prefix));
    if (entry === undefined) return null;
    document.cookie = `${FUNNEL_SIGNUP_COOKIE_NAME}=; Max-Age=0; Path=/; Domain=${SIGNUP_CONVERSION_COOKIE_DOMAIN}`;
    const value = entry.slice(prefix.length);
    return isOneOf(SIGNUP_METHODS, value) ? value : null;
}
