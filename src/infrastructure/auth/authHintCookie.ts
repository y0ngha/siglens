import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

export { AUTH_HINT_COOKIE_NAME };

/** Cookie descriptor returned by hint cookie factories. */
export interface AuthHintCookieDescriptor {
    readonly name: string;
    readonly value: string;
    readonly maxAge: number;
    readonly path: string;
    readonly sameSite: 'lax';
    readonly secure: boolean;
    readonly httpOnly: false;
}

/** Builds an active hint cookie to set alongside the session cookie on login. */
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

/** Builds an expired hint cookie to clear the hint on logout. */
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
