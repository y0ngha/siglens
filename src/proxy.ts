import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
// edge runtime 안전성을 위해 외부 의존이 0인 simple constant file에서 직접 import한다.
// `@/shared/config/market`은 `@y0ngha/siglens-core` 타입을 끌어와 cross-module
// type 의존성을 거치는데, Turbopack의 `import type` strip이 dev 환경에서 간헐적으로
// 누락돼 [symbol] 라우트 fetch가 차단되는 회귀가 관찰돼 회피한다 (자세한 배경은
// ticker.ts JSDoc 참조).
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { NextResponse, type NextRequest } from 'next/server';

/** App Router가 RSC 요청에만 붙이는 캐시 버스팅 쿼리 파라미터 (`NEXT_RSC_UNION_QUERY`). */
const RSC_CACHE_BUSTING_PARAM = '_rsc';

/** RSC 요청 여부. Next는 모든 RSC fetch에 `RSC: 1`을 붙인다. */
function isRscRequest(req: NextRequest): boolean {
    return req.headers.get('rsc') !== null;
}

const RESERVED_FIRST_SEGMENTS = new Set([
    'login',
    'signup',
    'forgot-password',
    'reset-password',
    'account',
    'economy',
    'market',
    'news',
    'onboarding',
    'portfolio',
    'share',
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
     * RSC 캐시 버스팅 파라미터 정규화.
     *
     * App Router는 RSC 요청(클라 내비게이션·prefetch)에만 `?_rsc=<hash>`를 붙이고
     * 언제나 `RSC: 1` 헤더를 함께 보낸다. 따라서 `_rsc`가 있는데 헤더가 없으면 그건
     * RSC 요청이 아니다 — 크롤러가 로그·리퍼러에서 주운 URL이거나 공유된 링크다.
     *
     * 이 조합을 그대로 두면 Next가 전체 HTML(종목 페이지 기준 1.8MB)을 `?_rsc=` URL로
     * 돌려준다. CDN은 요청 헤더를 캐시 키에 넣지 못하므로(무료 플랜) 그 HTML이 `?_rsc=`
     * 키에 저장되고, 같은 URL로 오는 진짜 RSC prefetch가 HTML을 받아 클라이언트
     * 내비게이션이 깨진다. 파라미터를 떼고 canonical URL로 돌려보내 origin이 그런 응답을
     * 애초에 만들지 않게 한다. (엣지 룰과의 관계는 docs/architecture/CDN_CACHING.md §3)
     *
     * status는 307(임시) — `_rsc` 해시는 라우터 상태·빌드마다 달라지는 일회성 값이라
     * 영구 매핑으로 캐싱되면 안 된다(`?q=` redirect와 같은 이유).
     *
     * 케이스 정규화 301보다 **먼저** 둔다. 홉 수는 어느 순서든 2로 같지만, 순서를 뒤집으면
     * 301의 Location에 `_rsc`가 그대로 실려 나간다(`canonicalUrl`은 pathname만 갈아끼운다).
     * 301은 브라우저·크롤러가 영구 캐싱하는 응답이라, RSC 일회성 파라미터가 붙은 URL을
     * canonical로 각인시키게 된다. `_rsc`를 먼저 떼면 301은 항상 깨끗한 URL만 가리킨다.
     */
    if (
        reqUrl.searchParams.has(RSC_CACHE_BUSTING_PARAM) &&
        !isRscRequest(req)
    ) {
        const cleanUrl = new URL(reqUrl);
        cleanUrl.searchParams.delete(RSC_CACHE_BUSTING_PARAM);
        return NextResponse.redirect(cleanUrl, 307);
    }

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
            // `SYMBOL_EDGE_RE`가 아니라 `isAdmissibleSymbolShape`을 쓴다 — 해외 거래소
            // 접미사(`HVO.L`)는 어차피 [symbol] 라우트에서 404가 되므로, 404로 redirect를
            // 발급하는 대신 랜딩 페이지로 fall through시킨다.
            if (isAdmissibleSymbolShape(ticker)) {
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
     * 동일 판정(`isAdmissibleSymbolShape`)을 ?q= redirect와 공유해 일관성을 유지한다
     * (예: PBR-A 같은 하이픈 ticker, BTCUSD 같은 크립토 심볼도 정규화).
     *
     * 형상 불합격 심볼은 정규화하지 않는다 — `/hvo.l` → 301 → `/HVO.L` → 404 라는
     * 2-hop 대신 곧바로 404를 내보내 크롤러가 리다이렉트 체인을 타지 않게 한다.
     */
    const firstSegment = pathname.split('/').filter(Boolean)[0];
    if (
        firstSegment !== undefined &&
        !RESERVED_FIRST_SEGMENTS.has(firstSegment.toLowerCase()) &&
        isAdmissibleSymbolShape(firstSegment) &&
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
        // page-level guards (e.g. `PortfolioGuard`, `OnboardingGuard`) redirect
        // unauthenticated visitors to `/login?next=<path>` so login returns them
        // to where they were headed — the proxy's forward guard fires first for
        // these same paths, so it must preserve `next=` too, or a guest hitting
        // `/portfolio` directly loses the return path entirely.
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

const GUEST_ONLY_PATHS = new Set([
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
]);

const AUTH_REQUIRED_PATHS = ['/account', '/portfolio'];

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|json|xml|txt|js|html|css|webmanifest|map|woff2?|ttf|otf|eot|mp4|webm)$).*)',
    ],
};
