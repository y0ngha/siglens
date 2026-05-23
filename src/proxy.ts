import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME } from '@/infrastructure/auth/sessionCookie';
import { VALID_TICKER_RE } from '@/domain/constants/market';

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

/**
 * 두 가지 가드를 처리하는 미들웨어 함수.
 *
 * 역방향 가드: 로그인된 사용자가 guest-only 페이지(/login, /signup 등)에 진입하면 / 로 redirect.
 * 전방 가드: 비로그인 사용자가 auth-required 페이지(/account 등)에 진입하면 /login 으로 redirect.
 */
export function proxy(req: NextRequest): NextResponse {
    const hasSession = !!req.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
    const reqUrl = new URL(req.url);
    const { pathname } = reqUrl;

    /**
     * 랜딩 검색 redirect.
     *
     * `/?q=AAPL` 형태의 WebSite SearchAction 요청을 종목 페이지로 즉시 redirect한다.
     * 이 처리를 page.tsx가 아닌 proxy에 두는 이유는, page.tsx에서 `searchParams`를
     * 소비하면 Next.js가 해당 라우트를 dynamic으로 분류해 ISR/`x-vercel-cache: HIT`을
     * 받을 수 없기 때문이다. proxy는 모든 요청에 대해 항상 실행되므로 redirect 처리는
     * 그대로 가능하고, page.tsx는 순수 정적 페이지로 캐싱될 수 있다.
     *
     * - 동일 키 중복(`?q=AAPL&q=TSLA`)은 첫 번째 값을 사용 (`get()`이 기본 동작)
     * - 유효 ticker가 아니면 fall through — page.tsx가 일반 랜딩으로 렌더
     * - status code는 기본값 307(임시) — 검색 쿼리는 브라우저가 영구 캐싱하지 않도록 의도
     */
    if (pathname === '/' && reqUrl.searchParams.has('q')) {
        const qRaw = reqUrl.searchParams.get('q');
        if (qRaw) {
            const ticker = qRaw.trim().toUpperCase();
            if (VALID_TICKER_RE.test(ticker)) {
                return NextResponse.redirect(new URL('/' + ticker, req.url));
            }
        }
    }

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
        VALID_TICKER_RE.test(firstSegment.toUpperCase()) &&
        firstSegment !== firstSegment.toUpperCase()
    ) {
        const canonicalUrl = new URL(reqUrl);
        canonicalUrl.pathname = pathname.replace(
            /^\/[^/]+/,
            '/' + firstSegment.toUpperCase()
        );
        return NextResponse.redirect(canonicalUrl, 301);
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
