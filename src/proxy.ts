import {
    AI_SSO_PROBED_COOKIE_NAME,
    AI_SSO_PROBED_MAX_AGE_SECONDS,
    AUTH_SESSION_COOKIE_NAME,
    GUEST_ID_COOKIE_NAME,
} from '@/shared/config/cookieNames';
import {
    guestIdCookieOptions,
    mintGuestCookieValue,
    verifyGuestCookie,
} from '@/shared/config/guestCookie';
// edge runtime 안전성을 위해 외부 의존이 0인 simple constant file에서 직접 import한다.
// `@/shared/config/market`은 `@y0ngha/siglens-core` 타입을 끌어와 cross-module
// type 의존성을 거치는데, Turbopack의 `import type` strip이 dev 환경에서 간헐적으로
// 누락돼 [symbol] 라우트 fetch가 차단되는 회귀가 관찰돼 회피한다 (자세한 배경은
// ticker.ts JSDoc 참조).
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { RESERVED_FIRST_SEGMENTS } from '@/shared/config/reservedFirstSegments';
// 가드 경로 목록은 클라이언트(`NavigationPendingContext`)가 도착지를 예측할 때도 쓴다.
// 외부 의존이 0인 상수 파일이라 edge runtime에서 안전하다.
import {
    AUTH_REQUIRED_PATHS,
    GUEST_ONLY_PATHS,
} from '@/shared/config/authGuardPaths';
// 로케일 상수도 외부 의존이 0인 파일이라 edge runtime에서 안전하다(위 주석과 같은 이유).
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    splitLocalePath,
} from '@/shared/i18n/locales';
import { routing } from '@/shared/i18n/routing';
import {
    DEFAULT_REDIRECT_PATH,
    sanitizeNextPath,
    toSameOriginPath,
} from '@/shared/lib/auth/redirect';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import {
    AI_INDEXABLE_PATHS,
    AI_SITE_URL,
    isAiHost,
    MAIN_SITE_URL,
} from '@/shared/config/aiHost';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * `img-src`를 좁히는 이유는 모델 출력에 섞인 이미지 URL로 대화 내용을 빼내는 경로를
 * 막기 위해서다(agent-chat 설계 "출력 위생"). Google Ads 전환 픽셀 호스트만 연다 —
 * Google 태그 CSP 가이드의 Ads 이미지 목록. 국가 도메인은 와일드카드가 안 돼서
 * 광고 대상인 한국만 넣었다.
 */
// ponytail: google.co.kr only — add each google.<TLD> if ads target other countries.
const AI_CSP =
    "frame-ancestors 'none'; img-src 'self' data: https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.co.kr";
/**
 * SiglensAI의 공개 면은 로케일별 홈과 `/about`(`AI_INDEXABLE_PATHS`)이다. 대화(`/c/*`)는 회원 본인만
 * 볼 수 있는 사적 기록이라 크롤러에 열 이유가 없고, 게스트에게는 404다.
 * `/api/`는 크롤러가 쓸 이유가 아예 없는 SSE 엔드포인트라 함께 막는다 —
 * `POST /api/ai/chat/stream`은 어차피 Origin 검사로 브라우저 세션만 받는다.
 *
 * 단 `/api/ai/og`(공유 미리보기 OG 이미지)는 **열어 둔다** — 홈·`/about`의 `og:image`가 이 경로라
 * `Disallow: /api/`만 있으면 크롤러·링크 미리보기 봇이 이미지를 못 가져간다. Google은 더 구체적인
 * (긴) 규칙이 이긴다지만 일부 파서는 파일 순서대로 첫 일치를 쓰므로 `Allow`를 **`Disallow: /api/`
 * 앞에** 둔다(순서는 테스트가 고정한다).
 */
const AI_ROBOTS_BODY = `User-agent: *\nAllow: /\nDisallow: /c/\nDisallow: /*/c/\nAllow: /api/ai/og\nDisallow: /api/\n\nSitemap: ${AI_SITE_URL}/sitemap.xml\n`;

/**
 * 색인 가능한 로케일의 공개 페이지(`AI_INDEXABLE_PATHS`: 홈·`/about`)만 싣는다 — 메인 사이트 정적 페이지와 같은 게이트
 * (`STATIC_INDEXABLE_LOCALES`). 대화 URL은 절대 싣지 않는다.
 */
function aiSitemapXml(): string {
    const urls = STATIC_INDEXABLE_LOCALES.flatMap(l =>
        AI_INDEXABLE_PATHS.map(
            path => `<url><loc>${AI_SITE_URL}${localePath(l, path)}</loc></url>`
        )
    ).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

/**
 * 광고 전용 랜딩(`src/app/lp/`). 호스트마다 정확히 한 페이지만 연다.
 *
 * 로케일 rewrite(메인의 next-intl, ai의 `/ai/[locale]`)를 타지 않는 별도 루트라
 * 두 호스트 모두 `/lp/*`를 그대로 라우터에 넘긴다. 아래 두 경우는 그냥 넘기면 안 된다.
 *
 * - **다른 호스트의 랜딩**: 404가 아니라 그 호스트로 **308**. 광고 최종 URL을 호스트
 *   착각으로 잘못 걸어도(예: `siglens.io/lp/stock-chat`) 방문자가 맞는 페이지에 닿는다.
 *   308은 메서드·본문을 보존하는 영구 이동이고 쿼리(`gclid`·`utm_*`)를 그대로 싣는다 —
 *   전환 측정이 끊기지 않는다. 목적지 호스트는 의존성 0인 `aiHost` 설정에서 읽는다
 *   (이 파일은 엣지 런타임이라 `shared/lib/seo`를 끌어오지 않는다).
 * - **모르는 `/lp/*`**: 그대로 넘기면 `[locale]/[symbol]`이 `lp`를 로케일로 받아 레이아웃
 *   `notFound()`의 빈 404가 되고, 직접 `NextResponse('Not Found')`를 쓰면 본문이 한
 *   줄짜리 텍스트다. 어떤 라우트에도 매칭되지 않는 경로로 **rewrite**해 루트
 *   `not-found.tsx`(브랜드 바·홈 링크가 있는 404)가 404 상태로 렌더되게 한다.
 *
 * 페이지 메타데이터도 noindex지만, 리다이렉트·404까지 덮도록 헤더로도 막는다.
 * (spec `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`)
 */
const LP_PATH_BY_HOST = {
    main: '/lp/stock-analysis',
    ai: '/lp/stock-chat',
} as const;

type LandingHost = keyof typeof LP_PATH_BY_HOST;

const OTHER_LANDING_HOST: Record<LandingHost, LandingHost> = {
    main: 'ai',
    ai: 'main',
};

const LANDING_HOST_ORIGIN: Record<LandingHost, string> = {
    main: MAIN_SITE_URL,
    ai: AI_SITE_URL,
};

/**
 * 어떤 라우트에도 매칭되지 않는 경로 — 모르는 `/lp/*`를 루트 `not-found.tsx`로 보내는
 * rewrite 목적지다. `[locale]/[symbol]/<탭>` 구조가 3세그먼트까지 매칭하므로 4세그먼트에
 * 실재하지 않는 첫 세그먼트를 쓴다.
 */
const LP_NOT_FOUND_PATH = '/__lp_not_found__/x/y/z';

function isLandingPath(pathname: string): boolean {
    return pathname === '/lp' || pathname.startsWith('/lp/');
}

function landingResponseFor(req: NextRequest, host: LandingHost): NextResponse {
    const url = new URL(req.url);
    if (url.pathname === LP_PATH_BY_HOST[host]) {
        return host === 'ai' ? NextResponse.rewrite(url) : NextResponse.next();
    }
    if (url.pathname === LP_PATH_BY_HOST[OTHER_LANDING_HOST[host]]) {
        const target = new URL(
            `${url.pathname}${url.search}`,
            LANDING_HOST_ORIGIN[OTHER_LANDING_HOST[host]]
        );
        // 두 호스트 설정이 같은 오리진을 가리키면(로컬 개발 등) 308이 자기 자신으로
        // 돌아와 무한 루프가 된다 — 그땐 404로 끝낸다.
        //
        // 비교 대상은 `req.url`의 호스트가 아니라 **Host 헤더**다. 프로덕션 `next start`는
        // `req.url`을 요청 헤더가 아니라 서버가 바인딩한 `localhost:<port>`로 다시 만들어
        // (`resolve-routes`의 `initUrl`) Host가 `ai.localhost:4300`이어도 URL은 `localhost:4300`이다.
        // `url.host`로 비교하면 ai 호스트에서 메인으로 가는 308이 로컬·e2e에서만(메인 오리진이
        // 서버 바인딩 주소와 같을 때) 자기 자신으로 오인돼 404가 된다. 호스트 판정(`isAiHost`)이
        // 이미 Host 헤더를 쓰므로 같은 기준으로 맞춘다. `target.host`는 URL이 소문자로
        // 정규화하므로 헤더도 소문자로 맞춘다(대소문자만 다른 Host가 불필요한 308을 타지 않게).
        const requestHost = (req.headers.get('host') ?? url.host).toLowerCase();
        if (target.host !== requestHost)
            return NextResponse.redirect(target, 308);
    }
    return NextResponse.rewrite(new URL(LP_NOT_FOUND_PATH, url));
}

function landingPageResponse(
    req: NextRequest,
    host: LandingHost
): NextResponse {
    const response = landingResponseFor(req, host);
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
}

/**
 * 로케일 접두사가 붙은 랜딩(`/en/lp/stock-analysis`, `/ja/lp/stock-chat`)은
 * 접두사를 뗀 `/lp/*`로 301한다. 랜딩은 한국어 전용이라 로케일 변형이 없다.
 *
 * 원시 경로만 보는 `isLandingPath` 검사로는 이 형태가 빠져 메인은
 * `[locale]/[symbol]`, ai는 `/ai/[locale]/*`로 흘러간다. 접두사를 뗀 결과가
 * 모르는 `/lp/*`여도 리다이렉트 후 위 404 가드가 받으므로 심볼 라우트에 닿지
 * 않는다. 기존 `/ko/lp/*` 301과 같은 동작을 모든 로케일로 넓힌 것이다.
 */
function landingLocaleRedirect(req: NextRequest): NextResponse | null {
    const url = new URL(req.url);
    const { path } = splitLocalePath(url.pathname);
    if (path === url.pathname || !isLandingPath(path)) return null;
    url.pathname = path;
    const response = NextResponse.redirect(url, 301);
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
}

/** `ai.siglens.io`(SiglensAI) 호스트 요청을 `/ai/[locale]/*`로 rewrite한다. */
async function handleAiHost(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    if (isLandingPath(url.pathname)) {
        const response = landingPageResponse(req, 'ai');
        response.headers.set('Content-Security-Policy', AI_CSP);
        return response;
    }
    const landingRedirect = landingLocaleRedirect(req);
    if (landingRedirect) return landingRedirect;
    if (url.pathname === '/robots.txt') {
        return new NextResponse(AI_ROBOTS_BODY, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
    if (url.pathname === '/sitemap.xml') {
        return new NextResponse(aiSitemapXml(), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
    const { locale, path } = splitLocalePath(url.pathname);
    /**
     * `/ko/*` → `/*` **영구** 정규화 — 메인 호스트(`proxy` 본문의 같은 규칙)와 맞춘다.
     * 기본 로케일은 접두사 없는 URL이 정본인데(`localePath`, ai sitemap·hreflang), 이게
     * 없으면 `/ko/about`이 200으로 같은 페이지를 한 벌 더 내놓아 중복 URL이 된다.
     * 쿼리(`q`, 광고 클릭 id 등)는 보존한다. `/api/*`는 matcher 밖이라 POST 스트림은
     * 여기를 지나지 않는다.
     */
    if (locale === DEFAULT_LOCALE && url.pathname !== path) {
        const canonicalUrl = new URL(url);
        canonicalUrl.pathname = path;
        return NextResponse.redirect(canonicalUrl, 301);
    }
    const rewriteUrl = new URL(url);
    rewriteUrl.pathname = `/ai/${locale}${path === '/' ? '' : path}`;
    const headers = new Headers(req.headers);
    headers.set('X-NEXT-INTL-LOCALE', locale);
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers } });
    response.headers.set('Content-Security-Policy', AI_CSP);
    // 페이지 메타데이터도 noindex지만, 404·에러 응답까지 확실히 덮도록 헤더로도 막는다.
    if (path === '/c' || path.startsWith('/c/'))
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    /**
     * `?sso=none`은 핸드오프를 한 번 돌았는데 메인 사이트 세션이 없었다는 표식이다.
     * 페이지는 이 파라미터만 보고 재시도를 건너뛰는데, 방문자가 랜딩에서 다른 링크로
     * 나가면(그리고 클라이언트가 주소창에서 `sso`를 지우면) 파라미터가 사라져 **같은
     * 왕복이 다시** 돈다. 그래서 프로브 완료를 쿠키로도 남겨 짧게 기억한다.
     *
     * ⚠️ 여기서 **리다이렉트하지 않는다** — `sso`를 지우는 리다이렉트는 크롤러·광고
     * 클릭 식별자(`gclid`)가 있는 첫 방문의 응답을 한 홉 늘리고, 이 프록시는 모든
     * ai 호스트 요청이 지나는 자리다. 200 rewrite에 쿠키만 얹고, 주소창 정리는 클라이언트
     * (`ChatShell`의 `replaceState`)가 한다.
     */
    if (url.searchParams.get('sso') === 'none') {
        response.cookies.set(AI_SSO_PROBED_COOKIE_NAME, '1', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: AI_SSO_PROBED_MAX_AGE_SECONDS,
        });
    }
    /**
     * 게스트 쿠키는 여기, 페이지 뷰에서만 발급한다 — `/api/ai/chat/stream`은
     * 이 쿠키가 서명까지 유효해야만 게스트를 받는다(`readGuestId`, 절대 스스로
     * 발급하지 않음). 그래야 진짜 브라우저로 페이지를 한 번이라도 연 세션만
     * API를 부를 수 있고, 쿠키 없이 곧바로 스트림 엔드포인트를 두드리는 스크립트는
     * 401로 막힌다.
     *
     * 세션 쿠키 보유 여부와 무관하게 검사한다 — `siglens_session` 쿠키는 존재만
     * 확인 가능할 뿐 여기서 DB로 유효성을 검증하지 않는데, 스트림 라우트는
     * `getCurrentUser()`로 세션을 DB째 검증한다. 죽은 세션 쿠키를 가진 방문자를
     * "회원이니 게스트 쿠키 불필요"로 스킵하면 그 방문자는 회원도 게스트도 아닌
     * 신원 미확정 상태로 스트림 라우트에서 영구 401을 받는다. 실제 회원에게는
     * 이 쿠키가 있어도 무해하다 — 스트림 라우트가 세션을 먼저 확인해 주체를
     * 회원 id로 확정하고 게스트 쿠키는 아예 읽지 않는다.
     */
    const existingGuestId = await verifyGuestCookie(
        req.cookies.get(GUEST_ID_COOKIE_NAME)?.value
    );
    if (existingGuestId === null) {
        try {
            response.cookies.set(
                GUEST_ID_COOKIE_NAME,
                await mintGuestCookieValue(),
                guestIdCookieOptions()
            );
        } catch (error) {
            // fail closed: 서명 시크릿이 없으면 쿠키를 심지 않을 뿐, 페이지 렌더
            // 자체를 막지는 않는다. 마커로 1회만 남긴다.
            console.error('[proxy] guest cookie mint failed:', error);
        }
    }
    return response;
}

/**
 * 서버 액션 POST(`Next-Action` 헤더)인지 본다. 이런 요청은 아래 두 인증 가드를
 * 건너뛴다.
 *
 * 왜 건너뛰나: `/portfolio`·`/account`를 열어 둔 탭에서 세션이 만료되거나 쿠키가
 * 지워지면, 그 페이지의 React Query 서버 액션 POST가 전방 가드에 걸려 `/login`으로
 * 307된다. 브라우저는 POST를 `/login`에 그대로 다시 보내는데 그 라우트는 해당 액션을
 * 등록하지 않아 Next가 "Failed to find Server Action"을 내고, 클라이언트는 이를 버전
 * 스큐로 보고 페이지 전체를 새로고침한다(`providers.tsx`의 `reloadOnVersionSkew`).
 * 로그인된 사용자가 `/login`에서 액션을 보내는 반대 방향도 같은 식으로 깨진다.
 *
 * 왜 안전한가: 이 가드는 처음부터 보안 경계가 아니었다.
 *  - 가드는 세션 쿠키가 **있는지만** 본다(유효성은 안 본다). 아무 값이나 든 쿠키를
 *    붙이면 통과한다.
 *  - 액션 ID는 경로가 아니라 서버 액션 매니페스트로 찾는다. 회원 액션 대부분
 *    (보유종목 조회·저장·삭제 등)은 가드 밖 페이지(`/[symbol]/*`) 워커에도 등록돼
 *    있다(2026-10 빌드의 `.next/server/server-reference-manifest.json` 기준). Next
 *    16.3.6은 현재 라우트 워커에 액션이 없으면 등록된 워커로 포워딩한다
 *    (`next/dist/server/app-render/action-handler.js` `selectWorkerForForwarding`).
 *  - 그래서 인증은 각 액션이 `getCurrentUser()`로 직접 한다. 사용자 데이터를 읽거나
 *    쓰는 액션(portfolio·api-key·chat-conversation·account-delete)은 전부 세션이 없으면
 *    빈 결과·`unauthenticated` 에러·`/login` 리다이렉트를 돌려주고 아무것도 바꾸지
 *    않는다 — 2026-10 서버 액션 인증 감사에서 전수 확인했다. 새 회원
 *    전용 액션도 이 규칙을 따라야 한다. 이 프록시에 기대면 안 된다.
 *
 * 페이지 내비게이션은 그대로 가드를 탄다. 액션은 항상 POST라 메서드도 함께 본다 —
 * 헤더만 붙인 GET이 가드를 건너뛰지 않게 한다.
 */
function isServerActionRequest(req: NextRequest): boolean {
    return req.method === 'POST' && req.headers.has('next-action');
}

/**
 * 두 가지 가드를 처리하는 미들웨어 함수.
 *
 * 역방향 가드: 로그인된 사용자가 guest-only 페이지(/login, /signup 등)에 진입하면 / 로 redirect.
 * 전방 가드: 비로그인 사용자가 auth-required 페이지(/account 등)에 진입하면 /login 으로 redirect.
 */
export async function proxy(req: NextRequest): Promise<NextResponse> {
    if (isAiHost(req.headers.get('host'))) return handleAiHost(req);
    const rawPathname = new URL(req.url).pathname;
    if (rawPathname === '/robots.txt' || rawPathname === '/sitemap.xml')
        return NextResponse.next();
    if (isLandingPath(rawPathname)) return landingPageResponse(req, 'main');
    const landingRedirect = landingLocaleRedirect(req);
    if (landingRedirect) return landingRedirect;

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
     * 레거시 `/onboarding` 라우트 — 페이지 자체는 지웠지만 (보유종목 관리는
     * `/portfolio`로 이관됐다) 북마크·진행 중인 가입 흐름·외부에 공유된
     * 링크가 여전히 이 경로를 가리킬 수 있다. 같은 로케일의 `/portfolio`로
     * 영구 리다이렉트하고, `?symbol=`(`/[symbol]/position` CTA에서 온 값)을
     * 포함한 쿼리스트링을 그대로 보존한다.
     */
    if (pathname === '/onboarding') {
        return NextResponse.redirect(
            new URL(
                `${localePath(locale, '/portfolio')}${reqUrl.search}`,
                req.url
            ),
            301
        );
    }

    /**
     * `/ai` 예약 라우트(SiglensAI) — 메인 호스트로 잘못 들어온 요청을
     * `ai.siglens.io`로 영구 이관한다.
     *
     * **정확히 소문자 `ai` 전체 세그먼트만** 매치한다 — `AI`는 실존 티커
     * (C3.ai, popular-tickers·sitemap 등재)라서 대소문자 무시로 매치하면
     * `/AI`·`/AI/news`·`/en/AI`가 전부 SiglensAI 호스트로 오탐 리다이렉트된다.
     * 로케일과 철자가 같은 티커를 구제하는 `KO` 판정과 같은 원칙이다.
     *
     * 로케일 접두사 제거(`/ko/*` 정규화)보다 먼저 처리해야 `/ko/ai/c/x`가
     * 2홉이 아니라 한 홉에 `https://ai.siglens.io/c/x`로 끝난다.
     */
    if (pathname.split('/').filter(Boolean)[0] === 'ai') {
        const rest = pathname.replace(/^\/ai(?=\/|$)/, '') || '/';
        // 내부 라우트 모양(`/ai/ko/c/x`)으로 들어오면 그 로케일을 쓴다 — 그대로 붙이면
        // ai 호스트의 `/ko/*` 301을 한 번 더 타 2홉이 된다.
        const inner = splitLocalePath(rest);
        const target =
            inner.path !== rest
                ? localePath(inner.locale, inner.path)
                : localePath(locale, rest);
        return NextResponse.redirect(
            new URL(`${target}${reqUrl.search}`, AI_SITE_URL),
            301
        );
    }

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
     * `/?q=AAPL` 형태의 **딥링크**를 종목 페이지로 즉시 redirect한다. 예전에는
     * `WebSite` SearchAction 마크업과 짝이었는데 그 선언은 지웠다 — 구글이
     * 사이트링크 검색창을 2023-11에 폐기했고 이 경로는 검색 결과 페이지도
     * 아니었다(`SiteJsonLd.tsx` 주석). 리다이렉트 자체는 티커를 아는 사용자의
     * 진입 경로로 계속 쓰인다.
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

    if (isServerActionRequest(req)) return intlMiddleware(req);

    if (GUEST_ONLY_PATHS.has(pathname) && hasSession) {
        // 이미 로그인된 사용자는 `next`(돌아갈 곳)를 따라 보낸다. 무시하고 홈으로
        // 보내면 SiglensAI 로그인 CTA(`/login?next=/api/auth/handoff?to=ai…`)를
        // 누른 메인 로그인 사용자 — ai 쪽만 로그아웃했거나, `?sso=none` 이후
        // 다른 탭에서 로그인한 경우 — 가 ai.siglens.io로 못 돌아가고 메인 홈에
        // 버려진다. 여기는 진짜 HTTP 리다이렉트라 핸드오프 302 체인도 브라우저가
        // 그대로 따라간다. `next`는 로그인 폼과 같은 2중 방어를 거친다.
        const next = toSameOriginPath(
            sanitizeNextPath(reqUrl.searchParams.get('next'))
        );
        // `next`가 또 다른 게스트 전용 경로면 한 홉 더 튕기지 않고 바로 홈으로.
        const nextPath = splitLocalePath(
            new URL(next, reqUrl.origin).pathname
        ).path;
        const target =
            next === DEFAULT_REDIRECT_PATH || GUEST_ONLY_PATHS.has(nextPath)
                ? localePath(locale, '/')
                : next;
        return NextResponse.redirect(new URL(target, req.url));
    }

    if (AUTH_REQUIRED_PATHS.some(p => pathname.startsWith(p)) && !hasSession) {
        // page-level guards (e.g. `PortfolioGuard`) redirect unauthenticated
        // visitors to `/login?next=<path>` so login returns them to where they
        // were headed — the proxy's forward guard fires first for these same
        // paths, so it must preserve `next=` too, or a guest hitting `/portfolio`
        // directly loses the return path entirely.
        const loginUrl = new URL(localePath(locale, '/login'), req.url);
        // `next`는 로케일이 붙은 경로로 저장한다 — 로그인 후 사용자가 자기 언어의
        // 원래 페이지로 돌아와야 한다.
        //
        // `reqUrl.search`도 반드시 붙인다 — 빠뜨리면 `/portfolio?symbol=AAPL`
        // (`/[symbol]/position`의 CTA)로 들어온 게스트가 로그인 후 심볼이
        // 채워지지 않은 빈 폼에 도착한다. `sanitizeNextPath`/`toSameOriginPath`는
        // 쿼리를 검사 대상에서 제외하고 그대로 통과시키므로 로그인 액션 쪽에서도
        // 안전하게 살아남는다 (redirect.ts 참고).
        loginUrl.searchParams.set(
            'next',
            localePath(locale, pathname) + reqUrl.search
        );
        return NextResponse.redirect(loginUrl);
    }

    // 가드를 통과하면 next-intl에 넘긴다. 여기서 `/ko/AAPL` → `/AAPL` 정규화와
    // `[locale]` 세그먼트로의 내부 rewrite가 일어난다.
    return intlMiddleware(req);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|json|xml|txt|js|html|css|webmanifest|map|woff2?|ttf|otf|eot|mp4|webm)$).*)',
        '/robots.txt',
        '/sitemap.xml',
    ],
};
