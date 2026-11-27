import { SIGNUP_VERIFICATION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from './authUseCaseConstants';
import { isSecureCookieEnv } from './sessionCookieOptions';

/** 가입 인증 바인딩 쿠키가 돌려주는 `cookies().set()` 인자. 페이지 스크립트가 읽을 수 없고 교차 사이트로 가지 않는다. */
interface SignupVerificationCookieDescriptor {
    readonly name: string;
    readonly value: string;
    readonly maxAge: number;
    readonly path: string;
    readonly sameSite: 'strict';
    readonly secure: boolean;
    readonly httpOnly: true;
}

/**
 * 이메일 인증을 마친 브라우저에 심는 바인딩 쿠키. 수명은 인증 마커와 같다.
 *
 * `Domain`을 주지 않아(호스트 전용) 하위 도메인으로 새지 않는다. `path`가 `/`인 이유: 가입 폼은
 * 로케일 접두사에 따라 `/signup`과 `/en/signup` 등 서로 다른 경로에서 액션을 보내므로 한 경로로
 * 좁히면 일부 로케일에서 쿠키가 가지 않는다. `__Host-` 접두사는 쓰지 않는다 — 이 값은 해시와 짝이
 * 맞는 한 마커 하나에만 쓰이고, 남이 심어 줘도(쿠키 토싱) 공격자가 얻는 것이 없다.
 */
export function createSignupVerificationCookie(
    bindingToken: string
): SignupVerificationCookieDescriptor {
    return {
        name: SIGNUP_VERIFICATION_COOKIE_NAME,
        value: bindingToken,
        maxAge: EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS,
        path: '/',
        sameSite: 'strict',
        secure: isSecureCookieEnv(),
        httpOnly: true,
    };
}

/** 가입이 끝난 뒤 바인딩 쿠키를 지우는 만료 쿠키. */
export function createExpiredSignupVerificationCookie(): SignupVerificationCookieDescriptor {
    return {
        name: SIGNUP_VERIFICATION_COOKIE_NAME,
        value: '',
        maxAge: 0,
        path: '/',
        sameSite: 'strict',
        secure: isSecureCookieEnv(),
        httpOnly: true,
    };
}
