import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

/** 힌트 쿠키 팩토리가 돌려주는 `cookies().set()` 인자. 클라이언트가 읽어야 하므로 `httpOnly`는 항상 false다. */
interface AuthHintCookieDescriptor {
    readonly name: string;
    readonly value: string;
    readonly maxAge: number;
    readonly path: string;
    readonly sameSite: 'lax';
    readonly secure: boolean;
    readonly httpOnly: false;
}

/** 로그인 시 세션 쿠키와 같이 심는 활성 힌트 쿠키. `maxAgeSeconds`는 세션 수명과 맞춘다. `secure` 생략 시 true. */
export function createAuthHintCookie(params: {
    maxAgeSeconds: number;
    secure?: boolean;
}): AuthHintCookieDescriptor {
    return {
        name: AUTH_HINT_COOKIE_NAME,
        value: '1',
        maxAge: params.maxAgeSeconds,
        path: '/',
        sameSite: 'lax',
        secure: params.secure ?? true,
        httpOnly: false,
    };
}

/** 로그아웃·탈퇴·죽은 세션 정리 때 힌트를 지우는 만료 쿠키. `secure` 생략 시 true. */
export function createExpiredAuthHintCookie(params?: {
    secure?: boolean;
}): AuthHintCookieDescriptor {
    return {
        name: AUTH_HINT_COOKIE_NAME,
        value: '',
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: params?.secure ?? true,
        httpOnly: false,
    };
}
