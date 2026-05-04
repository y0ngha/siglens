import { AUTH_SESSION_COOKIE_NAME } from '@/infrastructure/auth/sessionCookie';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 두 가지 가드를 처리하는 미들웨어 함수.
 *
 * 역방향 가드: 로그인된 사용자가 guest-only 페이지(/login, /signup 등)에 진입하면 / 로 redirect.
 * 전방 가드: 비로그인 사용자가 auth-required 페이지(/account 등)에 진입하면 /login 으로 redirect.
 */
export function proxy(req: NextRequest): NextResponse {
    const hasSession = !!req.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
    const { pathname } = new URL(req.url);

    if (GUEST_ONLY_PATHS.has(pathname) && hasSession) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    if (AUTH_REQUIRED_PATHS.some(p => pathname.startsWith(p)) && !hasSession) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
}

const GUEST_ONLY_PATHS = new Set([
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
]);

const AUTH_REQUIRED_PATHS = ['/account'];

export const config = {
    matcher: [
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/account/:path*',
    ],
};
