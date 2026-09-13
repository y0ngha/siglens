/**
 * 지원 로케일의 단일 소스.
 *
 * `routing.ts`(next-intl), 언어 스위처, SEO alternates, sitemap, proxy의
 * 예약 세그먼트가 전부 여기서 파생된다. 로케일을 추가할 때 손댈 곳은 이 파일과
 * `messages/{locale}/` 디렉터리뿐이다.
 */

export const LOCALES = ['ko', 'en', 'ja', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * 리터럴 타입으로 둔다(`: Locale`로 넓히지 않는다) — 그래야
 * `if (locale === DEFAULT_LOCALE) return;` 뒤에서 TypeScript가 `Exclude<Locale,'ko'>`로
 * 좁혀 준다. 대상 로케일만 받는 함수(번역 프롬프트·용어집 조회)가 컴파일러의
 * 보호를 받는다.
 */
export const DEFAULT_LOCALE = 'ko' satisfies Locale;

/**
 * 언어 전환 UI를 화면에 낼지.
 *
 * **지금은 끈다 — 한국어 고정으로 공개한다.** 다국어 자체(라우팅·카탈로그·
 * AI 산출물 언어)는 전부 살아 있고, 사용자가 언어를 **고를 수단**만 감춘다.
 * `/en/AAPL` 같은 URL은 그대로 동작하므로 hreflang·사이트맵·크롤러 경로에는
 * 영향이 없다.
 *
 * 여는 시점에 이 값만 `true`로 바꾸면 된다 — 헤더와 모바일 드로어가 같은
 * 플래그를 본다. 컴포넌트를 지우지 않는 이유가 그것이다.
 */
export const LOCALE_SWITCHER_VISIBLE = false;

/** 타입 가드 — 신뢰 경계(URL 세그먼트, 쿠키)에서 검증에 쓴다. */
/**
 * `Intl` API에 넘길 BCP-47 태그.
 *
 * 카탈로그 로케일(`ko`)과 지역까지 붙은 Intl 로케일(`ko-KR`)은 다르다. 날짜·숫자
 * 포맷은 지역에 따라 갈리므로(`en` vs `en-US`의 날짜 순서, `zh` vs `zh-Hans`)
 * 여기서 한 번만 정한다 — 호출부마다 문자열을 만들면 `/en/AAPL`이 `2026년 8월
 * 18일`을 찍던 것 같은 고정 로케일이 다시 새어 들어온다.
 */
export const INTL_LOCALE: Record<Locale, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-Hans-CN',
};

export function isLocale(value: string): value is Locale {
    return (LOCALES as readonly string[]).includes(value);
}

/**
 * 언어 스위처에 노출하는 자국어 표기. **번역하지 않는다** —
 * 사용자는 자기 언어를 자기 문자로 찾는다(영어권 사용자가 "영어"를 못 읽는다).
 */
export const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
    ko: '한국어',
    en: 'English',
    ja: '日本語',
    zh: '中文',
};

/**
 * hreflang에 쓰는 BCP-47 태그.
 *
 * 중국어만 `zh`가 아니라 `zh-Hans`다 — 간체/번체를 구분하지 않으면 검색엔진이
 * 대만·홍콩 사용자에게도 같은 URL을 제시한다. URL 세그먼트는 짧게 `/zh`로 두고
 * 태그만 정확히 발급한다.
 */
export const LOCALE_HREFLANG: Record<Locale, string> = {
    ko: 'ko',
    en: 'en',
    ja: 'ja',
    zh: 'zh-Hans',
};

/** Open Graph `og:locale` 형식(언어_지역). */
export const LOCALE_OG: Record<Locale, string> = {
    ko: 'ko_KR',
    en: 'en_US',
    ja: 'ja_JP',
    zh: 'zh_CN',
};

/** 정규식이 아니라 코드포인트로 본다 — `no-control-regex`를 억제하지 않기 위해서다. */
const MAX_STRIPPED_CODE_POINT = 0x20;

function stripLeadingSeparators(path: string): string {
    let i = 0;
    while (
        i < path.length &&
        (path[i] === '/' ||
            path[i] === '\\' ||
            path.charCodeAt(i) <= MAX_STRIPPED_CODE_POINT)
    )
        i += 1;
    return path.slice(i);
}

/**
 * `/api` 경로인지. 쿼리·해시가 붙은 경로(`/api/x?y=1`)도 판정한다.
 *
 * `/api/*`는 next-intl 매처 밖이라 로케일 접두사가 붙으면(`/en/api/…`) 404다.
 */
export function isApiPath(path: string): boolean {
    return /^\/api(?:[/?#]|$)/.test(path);
}

/**
 * 로케일 접두사를 붙인 경로를 만든다. 기본 로케일은 접두사가 없다
 * (`localePrefix: 'as-needed'`와 반드시 일치해야 한다).
 *
 * **결과는 절대 `//`·`/\` 로 시작하지 않는다.** 선행 `/`·`\`·공백/제어문자를 모두
 * 걷어낸 뒤 `/` 하나만 다시 붙인다. 호출자는 흔히 `splitLocalePath`로 접두사를
 * 뗀 나머지를 넘기는데, 기본 로케일은 접두사가 없어서 `/ko//evil.com` →
 * `//evil.com` → `new URL(…, base)` = `https://evil.com/`이 된다(sanitize를 이미
 * 통과한 값에서 프로토콜-상대 경로가 다시 생긴다). 모든 호출자가 여기를 지나므로
 * 한 곳에서 막는다. 탭·개행은 URL 파서가 지우므로(`/\t/evil.com`) 함께 걷어낸다.
 *
 * **`/api` 경로는 (같은 정규화 후) 그대로 돌려준다.** 로그인 `next`에 핸드오프 라우트
 * (`/api/auth/handoff?to=ai&next=…`)가 실려 오면 `LoginContent`·`localeHref`가
 * 이 함수를 거치는데, 접두사를 붙이면 비-ko 사용자만 로그인 직후 404에 떨어진다.
 *
 * @param locale 대상 로케일
 * @param path   `/`로 시작하는 로케일 없는 경로. `/`는 루트를 뜻한다.
 */
export function localePath(locale: Locale, path: string): string {
    const rooted = `/${stripLeadingSeparators(path)}`;
    if (isApiPath(rooted)) return rooted;
    const normalized = rooted === '/' ? '' : rooted;
    return locale === DEFAULT_LOCALE
        ? normalized || '/'
        : `/${locale}${normalized}`;
}

/**
 * 경로에서 로케일 접두사를 떼어낸다.
 *
 * **기본 로케일 접두사(`/ko/...`)도 떼어낸다.** `as-needed` 모드에서 `/ko/AAPL`은
 * `/AAPL`로 정규화되어야 하는 잉여 형태이고, 떼지 않으면 프록시의 티커 정규화가
 * 첫 세그먼트 `ko`를 심볼로 오인해 **`/KO`(코카콜라)로 301한다**. 실제로 존재하는
 * 티커라 404조차 나지 않고 조용히 엉뚱한 페이지가 뜬다.
 *
 * `usePathname()`은 라우터 컨텍스트 밖(테스트·스토리북)에서 `null`을 돌려줄 수 있다.
 * 클라이언트 컴포넌트가 이 함수를 직접 먹이므로 nullish를 신뢰 경계에서 흡수한다 —
 * 던지면 헤더 전체가 렌더되지 않는다.
 *
 * @returns 접두사가 없으면 기본 로케일과 원본 경로.
 */
export interface SplitLocalePathResult {
    readonly locale: Locale;
    /** 로케일 접두사를 뗀 경로. 항상 `/`로 시작한다. */
    readonly path: string;
}

export function splitLocalePath(
    pathname: string | null | undefined
): SplitLocalePathResult {
    if (!pathname) return { locale: DEFAULT_LOCALE, path: '/' };
    const [, first = '', ...rest] = pathname.split('/');
    if (!isLocale(first)) {
        return { locale: DEFAULT_LOCALE, path: pathname };
    }
    const remainder = rest.join('/');
    return { locale: first, path: remainder ? `/${remainder}` : '/' };
}

/**
 * 빌드 시점에 프리렌더할 로케일 목록을 결정한다.
 *
 * 기본은 **기본 로케일 하나**다. 정적 페이지 중 일부(`/market`, `/economy`)는
 * 빌드 중 외부 시세 API를 호출하는데, 로케일마다 같은 호출을 반복하면 FMP가
 * 429로 끊어 빌드가 실패한다(실측). 나머지 로케일은 `dynamicParams` 기본값에
 * 따라 첫 요청에 on-demand ISR로 생성된다.
 *
 * @param raw `PRERENDER_LOCALES` 환경변수 값(쉼표 구분). 비거나 유효한 로케일이
 *            하나도 없으면 기본 로케일만 반환한다 — 빈 배열을 반환하면
 *            `[locale]`이 dynamic으로 떨어져 ISR이 통째로 꺼진다.
 */
export function resolvePrerenderLocales(raw: string | undefined): Locale[] {
    const parsed = (raw ?? '')
        .split(',')
        .map(value => value.trim())
        .filter(isLocale);
    return parsed.length > 0 ? [...new Set(parsed)] : [DEFAULT_LOCALE];
}

/**
 * 분석 SSE 요청이 로케일을 싣는 헤더.
 *
 * `/api/*`는 next-intl 미들웨어 matcher에서 제외돼 있어(그래야 API가 `/ko/api/…`로
 * 리라이트되지 않는다) 서버가 요청 로케일을 알 수 없다. 그래서 클라이언트가
 * 명시적으로 싣는다. next-intl의 `X-NEXT-INTL-LOCALE`을 재사용하지 않는 이유는,
 * 그 헤더는 미들웨어가 소유하는 값이고 여기에 클라이언트가 끼어들면 두 출처가
 * 같은 이름을 두고 다투게 되기 때문이다.
 */
export const ANALYSIS_LOCALE_HEADER = 'x-siglens-locale';
