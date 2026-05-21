import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME } from '@/infrastructure/auth/sessionCookie';

const RESERVED_FIRST_SEGMENTS = new Set([
    'login',
    'signup',
    'forgot-password',
    'reset-password',
    'account',
    'market',
    'backtesting',
    'terms',
    'privacy',
    'api',
    '_next',
]);

// US ticker shape: 1–5 alpha chars, optional .X (e.g. BRK.B). Case-insensitive — we redirect non-uppercase forms to uppercase.
const TICKER_SEGMENT_CI_RE = /^[A-Za-z]{1,5}(\.[A-Za-z])?$/;

/**
 * 두 가지 가드를 처리하는 미들웨어 함수.
 *
 * 역방향 가드: 로그인된 사용자가 guest-only 페이지(/login, /signup 등)에 진입하면 / 로 redirect.
 * 전방 가드: 비로그인 사용자가 auth-required 페이지(/account 등)에 진입하면 /login 으로 redirect.
 */
export function proxy(req: NextRequest): NextResponse {
    const hasSession = !!req.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
    const { pathname } = new URL(req.url);

    /**
     * Ticker 경로 케이스 정규화.
     *
     * /[symbol]/* 페이지의 canonical은 항상 대문자 ticker로 발급되므로
     * 소문자/혼합 케이스로 진입한 요청을 대문자로 301 정규화한다.
     * 그렇지 않으면 self-referencing canonical 위반이 발생한다.
     *
     * 첫 segment가 명명된 페이지(login, market 등)일 때는 우회한다.
     */
    const firstSegment = pathname.split('/').filter(Boolean)[0];
    if (
        firstSegment !== undefined &&
        !RESERVED_FIRST_SEGMENTS.has(firstSegment.toLowerCase()) &&
        TICKER_SEGMENT_CI_RE.test(firstSegment) &&
        firstSegment !== firstSegment.toUpperCase()
    ) {
        const url = new URL(req.url);
        url.pathname = pathname.replace(
            /^\/[^/]+/,
            '/' + firstSegment.toUpperCase()
        );
        return NextResponse.redirect(url, 301);
    }

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
        '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|json|xml|txt|js|html|css|webmanifest|map|woff2?|ttf|otf|eot|mp4|webm)$).*)',
    ],
};
