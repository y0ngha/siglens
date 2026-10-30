import type { AuthSessionCookie } from '@/shared/lib/auth/types';
import type { ResponseCookie } from './types';

/** 유스케이스가 돌려준 `AuthSessionCookie`(`maxAgeSeconds`)를 `cookies().set()` 인자(`maxAge`)로 바꾼다. */
export function applyAuthCookie(cookie: AuthSessionCookie): ResponseCookie {
    return {
        name: cookie.name,
        value: cookie.value,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        path: cookie.path,
        expires: cookie.expires,
        maxAge: cookie.maxAgeSeconds,
    };
}
