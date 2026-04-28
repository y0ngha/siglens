import type { AuthSessionCookie } from '@y0ngha/siglens-core';
import type { ResponseCookie } from './types';

/** siglens-core의 AuthSessionCookie를 next/headers cookies().set() 형태로 변환한다. */
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
