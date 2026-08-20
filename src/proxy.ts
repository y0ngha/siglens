import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
// edge runtime 안전성을 위해 외부 의존이 0인 simple constant file에서 직접 import한다.
// `@/shared/config/market`은 `@y0ngha/siglens-core` 타입을 끌어와 cross-module
// type 의존성을 거치는데, Turbopack의 `import type` strip이 dev 환경에서 간헐적으로
// 누락돼 [symbol] 라우트 fetch가 차단되는 회귀가 관찰돼 회피한다 (자세한 배경은
// ticker.ts JSDoc 참조).
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
// 로케일 상수도 외부 의존이 0인 파일이라 edge runtime에서 안전하다(위 주석과 같은 이유).
import {
    DEFAULT_LOCALE,
    isLocale,
    LOCALES,
    localePath,
    splitLocalePath,
} from '@/shared/i18n/locales';
import { routing } from '@/shared/i18n/routing';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * 첫 segment가 여기 있으면 ticker 케이스 정규화를 건너뛴다.
 *
 * **`src/app/`의 모든 정적 최상위 라우트 디렉터리가 빠짐없이 들어 있어야 한다.**
 * `isAdmissibleSymbolShape`은 하이픈 ticker(`PBR-A`)를 허용하므로 `fear-greed`
 * 같은 라우트명도 심볼 형상 검사를 통과해 `/FEAR-GREED`로 301되어 버린다 —
 * 라우트는 정적 세그먼트 우선이라 빌드에서는 정상으로 보이고, 프록시가 라우팅보다
 * 먼저 도는 런타임에서만 깨진다. 새 최상위 라우트를 추가하면 여기도 추가한다
 * (`src/app/__tests__/proxy.test.ts`가 디렉터리 목록과 대조해 강제한다).
 */
const RESERVED_FIRST_SEGMENTS = new Set([
    // 로케일 접두사. `isAdmissibleSymbolShape('en')`은 참이라 여기 없으면
    // `/en`이 `/EN` 티커로 301된다. `ko`도 반드시 포함해야 한다 — `/ko`는 실존
    // 티커 `KO`(코카콜라)로 정규화되어 조용히 엉뚱한 페이지가 뜬다.
    ...LOCALES,
    'fear-greed',
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
    /**
     * 아래 가드는 전부 **로케일 접두사를 뗀 경로**로 판정한다.
     * 그래야 `/en/login`도 `/login`과 같은 게스트 전용 규칙을 받는다.
     * 리다이렉트를 발급할 때는 `localePath()`로 접두사를 다시 붙여 사용자가
     * 자기 언어에서 이탈하지 않게 한다.
     */
    const { locale, path: pathname } = splitLocalePath(reqUrl.pathname);

    /**
     * `/ko/*` → `/*` **영구** 정규화.
     *
     * next-intl에 맡기면 307(임시)로 나간다. 기본 로케일 접두사 제거는 임시가
     * 아니라 영구 규칙이므로, 307이면 Googlebot이 `/ko/*`를 계속 다시 크롤하고
     * 중복 URL이 하나로 합쳐지지 않는다.
     */
    /**
     * 파일 규약 메타데이터 이미지는 정규화 대상이 아니다.
     *
     * 라우트가 `[locale]` 아래로 이동하면서 Next가 이미지 URL을 **매칭된
     * 라우트 경로** 기준으로 만든다 — `/AAPL`의 `og:image`가
     * `/ko/AAPL/opengraph-image?...`로 나간다. 여기서 그걸 301로 처리하면
     * **색인되고 순위를 가진 한국어 페이지 전부**가 이미지 자리에 리다이렉트를
     * 광고하게 된다. Googlebot은 `robots.txt`가 막아 무관하지만 Twitterbot·
     * 카카오톡·네이버 Yeti는 그 경로를 따라가고, 리다이렉트가 캐시 무효화용
     * 쿼리(`?56400745...` → `?56400745...=`)까지 망가뜨린다.
     */
    const isMetadataImage = /\/(opengraph-image|twitter-image)(\/|$)/.test(
        pathname
    );

    if (isMetadataImage) {
        /**
         * 메타데이터 이미지는 **리다이렉트 없이, 그러나 반드시 로케일
         * 세그먼트로 rewrite해서** 넘긴다.
         *
         * 두 형태가 모두 살아 있어야 한다:
         *  - `/ko/AAPL/opengraph-image` — Next가 `[locale]` 라우트에서
         *    만들어 `og:image`에 싣는 형태. 여기에 301을 내면 순위를 가진
         *    한국어 페이지 전부가 이미지 자리에 리다이렉트를 광고한다.
         *    intl 미들웨어에 넘겨도 그쪽이 다시 307을 낸다(`as-needed` 정규화).
         *  - `/AAPL/opengraph-image` — **프로덕션이 지금 서빙하는 형태**.
         *    master에서는 라우트가 `src/app/[symbol]/`에 있었다. 이미 공유된
         *    링크와 Twitter·카카오·네이버·Slack 카드 캐시가 전부 이 URL을
         *    가리키므로 404가 되면 배포 즉시 카드가 깨진다.
         *
         * 그냥 `next()`로 통과시키면 두 번째 형태가 404가 되고, 3세그먼트
         * (`/AAPL/news/opengraph-image`)는 `[locale]`이 첫 세그먼트를 삼켜
         * **엉뚱한 이미지를 200으로** 돌려준다(실측: `/ko/news` 허브 카드).
         */
        if (reqUrl.pathname !== pathname) return NextResponse.next();
        return NextResponse.rewrite(
            new URL(`/${locale}${pathname}${reqUrl.search}`, req.url)
        );
    }

    if (locale === DEFAULT_LOCALE && reqUrl.pathname !== pathname) {
        const canonicalUrl = new URL(reqUrl);
        /**
         * 접두사를 떼면서 **티커 대문자화도 같이** 한다. 두 정규화를 따로 하면
         * `/ko/ko` → `/ko` → `/`가 되어 코카콜라가 아니라 홈으로 떨어진다
         * (첫 홉의 결과 `/ko`가 다시 기본 로케일 접두사로 읽히기 때문).
         * 소문자 티커 일반(`/ko/aapl`)도 2홉 체인이 1홉으로 줄어든다.
         *
         * 접두사가 이미 있던 경로이므로 로케일 이름은 예약어가 아니다 — 아래
         * `isReservedHere`와 같은 판단이다.
         */
        const stripped = pathname.split('/').filter(Boolean)[0];
        canonicalUrl.pathname =
            stripped !== undefined &&
            !(
                RESERVED_FIRST_SEGMENTS.has(stripped.toLowerCase()) &&
                !isLocale(stripped.toLowerCase())
            ) &&
            isAdmissibleSymbolShape(stripped)
                ? pathname.replace(/^\/[^/]+/, '/' + stripped.toUpperCase())
                : pathname;
        return NextResponse.redirect(canonicalUrl, 301);
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
                return NextResponse.redirect(
                    new URL(localePath(locale, '/' + ticker), req.url)
                );
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

    /**
     * 로케일과 **철자가 같은 티커** 구제. `KO`(코카콜라)가 대표 사례다.
     *
     * next-intl은 경로의 로케일 접두사를 **대소문자 무시**로 매칭한다
     * (`middleware/utils.js`의 `normalizedPathname === normalizedPrefix`).
     * 그래서 `/KO`가 로케일 `ko`로 잡혀 `/`로 리다이렉트되고, sitemap에 실린
     * `/KO`·`/KO/news`·`/KO/options` 등 8개 URL이 통째로 엉뚱한 페이지가 된다
     * (일부는 200을 반환하는 soft 404 — 2026-07 노출 붕괴와 같은 모양).
     *
     * 로케일은 전부 소문자이고 티커 정규형은 전부 대문자다. 그 차이로 가른다:
     * 소문자 정확일치만 로케일로 넘기고, 대문자는 티커로 확정해 intl 미들웨어를
     * 건너뛴 채 현재 로케일 세그먼트로 직접 rewrite한다.
     */
    if (
        firstSegment !== undefined &&
        firstSegment !== firstSegment.toLowerCase() &&
        isLocale(firstSegment.toLowerCase())
    ) {
        if (firstSegment !== firstSegment.toUpperCase()) {
            // `/Ko` 같은 혼합 표기는 다른 티커와 동일하게 대문자로 301 정규화한다.
            const canonicalUrl = new URL(reqUrl);
            canonicalUrl.pathname = localePath(
                locale,
                pathname.replace(/^\/[^/]+/, '/' + firstSegment.toUpperCase())
            );
            return NextResponse.redirect(canonicalUrl, 301);
        }
        // intl 미들웨어를 건너뛰므로 그것이 하던 두 가지를 직접 해야 한다:
        //  1) 쿼리스트링 보존 — `new URL(path, base)`는 원본 search를 버린다.
        //  2) `X-NEXT-INTL-LOCALE` 주입 — `getLocale()`이 이 헤더를 읽는다.
        //     빼면 `/ja/KO`에서 로그아웃한 사용자가 `localeRedirect('/')`로
        //     **한국어 홈**에 떨어진다(서버 액션 전부가 같은 경로를 탄다).
        const rewriteUrl = new URL(reqUrl);
        rewriteUrl.pathname = `/${locale}${pathname}`;
        const headers = new Headers(req.headers);
        headers.set('X-NEXT-INTL-LOCALE', locale);
        return NextResponse.rewrite(rewriteUrl, { request: { headers } });
    }

    /**
     * 예약 세그먼트 판정은 **기본 로케일 표면에서만** 로케일 이름을 포함해야 한다.
     *
     * `RESERVED_FIRST_SEGMENTS`에 `...LOCALES`가 들어 있는 이유는 `/en`이 티커
     * `EN`으로 301되는 것을 막기 위해서다. 그런데 이 판정을 **로케일 접두사를 뗀**
     * 경로에 그대로 적용하면, `/ja/ko`의 `ko`도 예약어로 걸려 대문자 정규화를
     * 건너뛴다 — `/ja/ko`와 `/ja/KO`가 같은 자산의 서로 다른 200 URL이 된다.
     * 접두사가 이미 있는 경로에서 첫 세그먼트는 무조건 심볼이므로 로케일 이름을
     * 예약어로 볼 이유가 없다.
     */
    const isPrefixed = reqUrl.pathname !== pathname;
    const isReservedHere =
        RESERVED_FIRST_SEGMENTS.has(firstSegment?.toLowerCase() ?? '') &&
        (!isPrefixed || !isLocale(firstSegment?.toLowerCase() ?? ''));

    if (
        firstSegment !== undefined &&
        !isReservedHere &&
        isAdmissibleSymbolShape(firstSegment) &&
        firstSegment !== firstSegment.toUpperCase()
    ) {
        const canonicalUrl = new URL(reqUrl);
        canonicalUrl.pathname = localePath(
            locale,
            pathname.replace(/^\/[^/]+/, '/' + firstSegment.toUpperCase())
        );
        return NextResponse.redirect(canonicalUrl, 301);
    }

    if (GUEST_ONLY_PATHS.has(pathname) && hasSession) {
        return NextResponse.redirect(new URL(localePath(locale, '/'), req.url));
    }

    if (AUTH_REQUIRED_PATHS.some(p => pathname.startsWith(p)) && !hasSession) {
        // page-level guards (e.g. `PortfolioGuard`, `OnboardingGuard`) redirect
        // unauthenticated visitors to `/login?next=<path>` so login returns them
        // to where they were headed — the proxy's forward guard fires first for
        // these same paths, so it must preserve `next=` too, or a guest hitting
        // `/portfolio` directly loses the return path entirely.
        const loginUrl = new URL(localePath(locale, '/login'), req.url);
        // `next`는 로케일이 붙은 경로로 저장한다 — 로그인 후 사용자가 자기 언어의
        // 원래 페이지로 돌아와야 한다.
        loginUrl.searchParams.set('next', localePath(locale, pathname));
        return NextResponse.redirect(loginUrl);
    }

    // 가드를 통과하면 next-intl에 넘긴다. 여기서 `/ko/AAPL` → `/AAPL` 정규화와
    // `[locale]` 세그먼트로의 내부 rewrite가 일어난다.
    return intlMiddleware(req);
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
