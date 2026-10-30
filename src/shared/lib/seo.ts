import type { Metadata } from 'next';
import {
    DEFAULT_LOCALE,
    localePath,
    LOCALE_HREFLANG,
    type Locale,
} from '@/shared/i18n/locales';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/config/brand';
import { brandName } from '@/shared/lib/brandName';

/** 브레드크럼 한 마디 — 화면 표시와 BreadcrumbList 구조화데이터가 공유한다. */
export interface BreadcrumbItem {
    name: string;
    url: string;
}

/** 화면 `<dl>`과 FAQPage 구조화데이터가 공유하는 질문·답변 한 쌍. */
export interface FaqItem {
    question: string;
    answer: string;
}

/**
 * `next-intl`의 `getTranslations`/`useTranslations` 반환값과 구조적으로 호환되는
 * 최소 형태. 이 파일이 `next-intl`을 직접 import하지 않는 이유(CLAUDE.md "pure
 * logic 모듈에 외부 라이브러리 금지" — provider는 entity/shared adapter가 감싼다):
 * 이 파일은 순수 문자열 조립 로직이고, 번역 SDK는 호출부(`generateMetadata` 등)가
 * 이미 알고 있다. 그래서 SDK 자체가 아니라 그 인터페이스만 여기 선언해 받는다.
 *
 * **기본값을 두지 않는다.** 기본값을 두면 호출부가 조용히 `t`를 누락해도 컴파일이
 * 통과하고, 그 결과 title/description이 `shared.seo.<key>` 같은 raw 키 문자열로
 * 렌더된다. 필수 파라미터로 두면 컴파일러가 모든 호출부를 강제로 나열해 준다.
 */
export type SeoTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

/**
 * 호스트가 로컬/개발 환경인지 판단한다.
 *
 * 다음 케이스를 로컬/개발 환경으로 간주하고 SITE_URL 검증에서 제외한다:
 *  - localhost, 127.0.0.1, 0.0.0.0, ::1 (루프백)
 *  - 도트(.)가 없는 단순 호스트 — TLD 없음, 예: "app", "myserver"
 *  - *.local 접미사 — mDNS/Bonjour 로컬 호스트명
 *
 * CI 환경에서 NEXT_PUBLIC_SITE_URL=http://localhost:4200 같은 값이 설정돼도
 * 빌드가 깨지지 않도록 하기 위한 예외 조건이다.
 */
function isLocalOrDevHost(host: string): boolean {
    // 루프백 주소 및 명시적 로컬 호스트명
    if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1'
    ) {
        return true;
    }
    // TLD 없는 단순 호스트명 (도트 미포함)
    if (!host.includes('.')) {
        return true;
    }
    // *.local mDNS 호스트명
    if (host.endsWith('.local')) {
        return true;
    }
    return false;
}

function parseHostname(rawUrl: string): string {
    try {
        return new URL(rawUrl).hostname;
    } catch {
        throw new Error(
            `[seo] NEXT_PUBLIC_SITE_URL="${rawUrl}"은 유효한 URL이 아닙니다.`
        );
    }
}

/**
 * 운영 호스트. `SITE_URL`의 기본값·프로덕션 가드와, 환경과 무관하게 항상 운영
 * 도메인을 보여줘야 하는 표시 문구(`/about` 예시 주소창)가 함께 쓴다.
 */
export const SITE_HOST = 'siglens.io';

/**
 * 사이트 URL. 환경 변수가 설정된 경우 그 값을, 없으면 기본값 'https://siglens.io'을 사용한다.
 *
 * 프로덕션 가드: NODE_ENV==='production'이고 NEXT_PUBLIC_SITE_URL이 설정됐는데
 * 호스트가 실제 원격 도메인이면서 'siglens.io'가 아닐 때 모듈 로드 시 즉시 throw한다.
 * 잘못된 프리뷰/ALB 도메인이 canonical·OG URL을 오염시키는 것을 빠른 실패로 막는다.
 *
 * 예외 — 아래 호스트는 로컬/개발/CI 환경으로 간주해 throw하지 않는다:
 *   localhost, 127.0.0.1, 0.0.0.0, ::1, TLD 없는 단순 호스트, *.local
 * 변수가 설정되지 않은 경우(기본값 사용)도 검사 대상이 아니므로 통과시킨다.
 */
function resolveSiteUrl(): string {
    const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const url = fromEnv ?? `https://${SITE_HOST}`;

    if (process.env.NODE_ENV === 'production' && fromEnv !== undefined) {
        const host = parseHostname(url);
        // 로컬/개발/CI 호스트는 빌드 안전을 위해 검증에서 제외한다.
        if (!isLocalOrDevHost(host) && host !== SITE_HOST) {
            throw new Error(
                `[seo] NEXT_PUBLIC_SITE_URL="${url}"의 호스트가 siglens.io가 아닙니다. ` +
                    `canonical/OG URL이 오염되는 것을 막기 위해 빠른 실패합니다.`
            );
        }
    }

    return url;
}

/**
 * 정규화된 사이트 오리진. canonical·OG·JSON-LD의 절대 URL 기준이며, 프로덕션에서
 * 운영 호스트가 아닌 값은 모듈 로드 시 던진다(`resolveSiteUrl`).
 */
export const SITE_URL = resolveSiteUrl();

/**
 * 문장에서 브랜드를 **처음 소개할 때** 쓰는 표기. ko는 한글 표기에 영문을
 * 괄호로 붙여 두 표기가 같은 서비스임을 한 번에 밝히고, 다른 로케일은 영문만 쓴다.
 *
 * 카탈로그 문구에 한글 표기를 직접 적지 않고 인자로 넘기는 이유: ko 문장만
 * 길어지면 번역 검증의 길이 게이트(`i18n:verify` 6번)가 다른 로케일을 잘린
 * 번역으로 본다.
 */
export function brandIntroName(locale: Locale): string {
    return locale === DEFAULT_LOCALE
        ? `${SITE_NAME_KO}(${SITE_NAME})`
        : SITE_NAME;
}

/**
 * 종목 디렉터리 경로. 페이지·푸터·sitemap이 같은 상수를 본다 — 한 곳만 바뀌면
 * 푸터가 404로 가는데 빌드도 테스트도 조용하다.
 */
export const SYMBOLS_PATH = '/symbols';

/**
 * 홈 `Organization` 노드의 `@id`. 홈 페이지(`(home)/page.tsx`)와 `/about`
 * 페이지가 각자 `${SITE_URL}#organization` 리터럴을 조립해 크롤러가 두 문서를
 * 같은 개체로 묶는 참조가 오타 하나로 갈릴 수 있었다 — 상수 하나로 묶는다.
 */
export const ORGANIZATION_JSON_LD_ID = `${SITE_URL}#organization`;

/** 사이트 발행 주체 `Organization`의 핵심 속성 — `buildOrganizationCoreJsonLd` 반환형. */
export interface OrganizationCoreJsonLd {
    readonly '@type': 'Organization';
    readonly '@id': string;
    readonly name: string;
    readonly url: string;
}

/**
 * 발행 주체 `Organization` 노드의 **핵심 속성**(`@id`·`name`·`url`).
 *
 * 전 페이지에 깔리는 `SiteJsonLd`가 `WebSite.publisher`의 참조 대상을 같은 문서 안에 두려고
 * 이 최소 노드를 싣고, 홈(`(home)/page.tsx`)은 이 위에 로고·설명·sameAs 등을 얹은 풍부한 노드를
 * 낸다. 같은 `@id`의 두 정의는 파서가 하나로 합치는데, 겹치는 속성 값이 다르면 충돌한다 —
 * 두 곳이 이 함수 하나에서 핵심 속성을 받아야 값이 갈릴 수 없다.
 */
export function buildOrganizationCoreJsonLd(): OrganizationCoreJsonLd {
    return {
        '@type': 'Organization',
        '@id': ORGANIZATION_JSON_LD_ID,
        name: SITE_NAME,
        url: SITE_URL,
    };
}

/**
 * 공개 소스 저장소. 푸터와 홈 `Organization.sameAs`가 소비자다.
 *
 * 상수로 두는 이유는 재사용이 아니라 **위치**다. 사이트를 가리키는 다른 URL이
 * 전부 여기 있으므로, JSON-LD `sameAs`에 싣는 소셜 프로필(`X_URL`·`VELOG_URL`)도
 * 이 파일 안에서 함께 다룬다. 푸터 JSX나 JSON-LD 안에 문자열로 박아두면 두 번째
 * 사본이 생긴다.
 */
export const GITHUB_URL = 'https://github.com/y0ngha/siglens';

/** 지표·패턴·신호 계산과 AI 프롬프트를 담은 분석 엔진(`@y0ngha/siglens-core`, MIT) 레포. */
export const CORE_GITHUB_URL = 'https://github.com/y0ngha/siglens-core';

/**
 * 서비스 공식 X(트위터) 계정. 홈 `Organization.sameAs`와 푸터 아이콘 링크가 소비한다.
 */
export const X_URL = 'https://x.com/siglens_io';

/**
 * 서비스 공식 velog 블로그. 홈 `Organization.sameAs`와 푸터 아이콘 링크가 소비한다 — 서비스 계정이라 조직
 * 노드에 싣는다(운영자 개인 프로필은 `OPERATOR_SAME_AS`, 2026-10-18 사용자 결정으로 개인
 * velog는 뺐다).
 */
export const VELOG_URL = 'https://velog.io/@siglens';

/**
 * 종목은 살아 있지만 **탭 자체를 색인하지 않기로 정한** 페이지의 robots.
 *
 * 2026-10-01 SEO 감사로 종목별 색인을 차트·뉴스·공포탐욕 세 탭으로 좁혔다. overall·fundamental·financials·
 * congress·flows·options 여섯 탭은 이 값을 쓴다.
 *
 * `NOINDEX_SYMBOL_METADATA`(실존하지 않는 종목·degrade용)와 같은 robots이고 둘 다
 * self-canonical을 쓴다 — 이 페이지들은 정상 페이지라 제목·설명도 그대로 둔다.
 * `follow: true`인 이유는 `NOINDEX_SYMBOL_METADATA` 주석과 같다(형제 탭 크롤 경로).
 *
 * 여섯 페이지가 같은 상수를 써야 sitemap 빌더(`buildPopularEntries`)의 "이 탭은
 * 싣지 않는다"와 한 곳에서 대응된다. 탭을 다시 열 때는 여기가 아니라 각 페이지에서
 * 이 값을 걷어내고 sitemap 빌더에 엔트리를 되돌린다.
 */
export const ALWAYS_NOINDEX_TAB_ROBOTS = {
    index: false,
    follow: true,
} as const satisfies NonNullable<Metadata['robots']>;

/**
 * `[symbol]` 라우트 noindex 분기의 robots — **색인은 막고 링크는 따라가게** 둔다.
 *
 * `follow: true`인 이유: 차단된 심볼 페이지도 본문에 같은 심볼의 다른 탭(뉴스·공포탐욕…)
 * 링크를 렌더하므로, nofollow는 크롤러가 그 형제 탭에 도달하는 유일한 경로를 막는다.
 * `[symbol]/options/page.tsx`가 옵션 없는 종목에 대해 이미 `{ index: false, follow: true }`를
 * 쓰고 같은 근거를 남겨 뒀다.
 *
 * **canonical은 이 상수의 몫이 아니다 (2026-10-05).** 예전에는 `alternates: { canonical: null }`을
 * 함께 담아 루트 레이아웃의 홈 canonical 상속을 막았는데, canonical이 없는 noindex 페이지는
 * 신호가 비어 크롤러가 URL 군집을 스스로 추정하게 둔다. 항상-noindex 탭(`ALWAYS_NOINDEX_TAB_ROBOTS`)
 * 과 같은 방식 — **자기 URL을 가리키는 self-canonical** — 으로 통일했다. 심볼을 아는 분기는
 * `noindexSymbolMetadata`가 `symbolMetadataFromSeo`의 self-canonical을 낸다. 심볼이라 믿을 수 없는
 * 세그먼트(`!isAdmissibleSymbolShape`)는 메타를 내지 않고 `generateMetadata`에서 `notFound()`를
 * 던져 404 경계(`[locale]/not-found.tsx`)의 메타를 쓴다.
 * 이 상수를 그대로 반환하면 canonical 없이 루트 레이아웃의 홈 title·og·twitter를 상속하므로
 * 라우트에서 직접 반환하지 않는다 — robots가 필요한 곳(스프레드·테스트)에서만 쓴다.
 * (루트 레이아웃 자체는 canonical을 깔지 않는다 — `[locale]/layout.tsx` 참고.)
 */
export const NOINDEX_SYMBOL_METADATA: Metadata = {
    robots: { index: false, follow: true },
};

// 빌드 시각 — 매 요청마다 변동되면 안 되는 schema.org datePublished 등에 사용.
// NEXT_BUILD_DATE env가 있으면 우선, 없으면 모듈 로드 시각(deploy 시점)을 한 번만 캐시.
function parseBuildDate(): Date {
    const raw = process.env.NEXT_BUILD_DATE;
    if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}
/** 빌드 시각 — 모듈 로드 시 한 번 고정되어 요청마다 바뀌지 않는다. */
export const SITE_BUILD_DATE = parseBuildDate();

/**
 * 홈 카피(제목·설명·헤드라인)는 `shared.seo.root` 카탈로그가 소유한다.
 *
 * 예전에는 여기 한국어 상수로 있었다 — 그래서 `/en`의 홈 JSON-LD가
 * `inLanguage: "en"`을 달고 한국어 산문을 실어 보냈다. 이 모듈은 요청 스코프가
 * 없으므로 문구를 들 수 없고, 소비 지점(레이아웃·홈 페이지)이 번역자로 읽는다.
 */

// 한글 SERP는 80~120자가 안전권이라 키워드는 핵심 검색의도 위주로 추렸다.
export const ROOT_KEYWORDS = [
    'SIGLENS',
    '미국 주식 AI 분석',
    '미국 주식 차트 분석',
    '미국 주식 펀더멘털',
    '미국 주식 뉴스',
    '미국 주식 옵션',
    'AI 종합 분석',
    '공포 탐욕 지수',
    'AI 주식 백테스팅',
    '오늘의 미국 주식',
    '섹터별 주식 분석',
    '미국 주식 PER',
    '한국 주식 AI 분석',
    '코스피 종목 분석',
    '코스닥 종목 분석',
    '국내 주식 차트 분석',
    '암호화폐 분석',
    '비트코인 시세',
    '이더리움 시세',
    '코인 AI 분석',
    '암호화폐 차트 분석',
    '비트코인 차트',
];

/**
 * 절대 URL에 로케일 접두사를 붙인다.
 *
 * JSON-LD의 `url`·`@id`는 **canonical과 같은 문서를 가리켜야 한다.** 예전에는
 * 기본 로케일 URL을 그대로 실어서, `/en/AAPL`이
 * `<link rel="canonical" href=".../en/AAPL">`를 걸어 놓고 `WebPage.url`은
 * `.../AAPL`을 말했다. 더 나쁜 건 `@id`다 — `${url}#webpage`라서 **네 로케일이
 * 전부 같은 `@id`를 발행하면서** 각자 다른 `inLanguage`와 `name`을 선언했다.
 * 한 노드를 네 문서가 동시에 자처하는 상태다.
 */
export function localizedAbsoluteUrl(url: string, locale: Locale): string {
    // 기본 로케일은 접두사가 없다. 원본을 그대로 돌려줘야 `SITE_URL`처럼
    // 경로가 빈 URL에 `/`가 새로 붙는 일이 없다.
    if (locale === DEFAULT_LOCALE) return url;
    const path = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
    return `${SITE_URL}${localePath(locale, path || '/')}`;
}

/**
 * 심볼 페이지들이 공유하는 WebPage JSON-LD 노드를 생성한다.
 * `about`은 stock으로 분류된 경우에만 채워지며, 없으면 키 자체를 생략한다.
 *
 * 반환 형태:
 * {
 *   "@context": "https://schema.org",
 *   "@type": "WebPage",
 *   "@id": `${url}#webpage`,
 *   name, description, url,
 *   inLanguage: "ko",
 *   isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}#website` },
 *   ...(about && { about }),
 * }
 */
export function buildWebPageJsonLd(params: {
    url: string;
    name: string;
    description: string;
    about?: Record<string, unknown>;
    /**
     * 이 문서의 언어. **기본값을 두지 않는다** — 두면 호출부에서 빠져도
     * 컴파일이 통과하고, 그 페이지만 조용히 `ko`를 자처한다. `/en/AAPL`의
     * `WebPage`가 `inLanguage: "ko"`를 달고 있던 게 그 결과다(형제 `Article`
     * 노드는 이미 로케일을 따르고 있어 한 페이지 안에서 서로 어긋났다).
     */
    locale: Locale;
}): Record<string, unknown> {
    const { url, name, description, about, locale } = params;
    const localizedUrl = localizedAbsoluteUrl(url, locale);
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${localizedUrl}#webpage`,
        name,
        description,
        url: localizedUrl,
        // `<html lang>`과 같은 태그를 쓴다 — `zh`는 `<html lang="zh-Hans">`인데
        // JSON-LD만 `zh`를 선언해 한 문서가 두 언어 태그를 말하고 있었다.
        inLanguage: LOCALE_HREFLANG[locale],
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        ...(about && { about }),
    };
}

// 홈(`brandName(locale)` → SITE_URL)이 첫 항목으로 자동 삽입된다 — 가시 브레드크럼
// (`shared/ui/Breadcrumb`·`SymbolLayoutHeader`)의 홈 마디와 같은 표기다.
// schema.org BreadcrumbList의 `item`은 절대 URL이어야 하므로
// 상대 경로로 들어온 trail은 SITE_URL prefix를 붙여 절대화한다.
//
// `name`은 **화면에 보이는 브레드크럼 텍스트와 같아야 한다**. 구글은 둘이 다르면
// 리치 결과에서 마크업을 무시한다. 종목 페이지의 가시 브레드크럼
// (`views/symbol/SymbolLayoutHeader`)은 `buildDisplayName` 결과를 색만 나눠
// 렌더하므로(예: `애플, Apple Inc. (AAPL)`), 종목 탭들은 티커가 아니라
// `displayName`을 넘긴다.
export function buildBreadcrumbJsonLd(
    trail: readonly BreadcrumbItem[],
    // 기본값을 두지 않는다 — 두면 호출부에서 빠져도 컴파일이 통과하고, 그
    // 페이지의 breadcrumb만 조용히 기본 로케일 URL을 가리킨다.
    locale: Locale
): Record<string, unknown> {
    const items: BreadcrumbItem[] = [
        { name: brandName(locale), url: SITE_URL },
        ...trail,
    ];
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: localizedAbsoluteUrl(
                item.url.startsWith('http')
                    ? item.url
                    : `${SITE_URL}${item.url}`,
                locale
            ),
        })),
    };
}

/**
 * FAQPage 구조화데이터를 만든다. 인자로 받은 배열은 반드시 `shared/ui/FaqSection`이
 * 같은 페이지에 렌더하는 배열과 **같은 상수**여야 한다.
 *
 * 구글은 FAQPage에 대응하는 질문·답변이 페이지에 실제로 보일 것을 요구한다. 마크업만
 * 있고 화면에 없으면 리치 결과 자격이 없을 뿐 아니라 수동 조치 사유다. 종목 탭 5개가
 * 오랫동안 그 상태였다 — 답변 텍스트를 JSON-LD 리터럴 안에만 두면 화면 카피를 고칠 때
 * 마크업이 따라오지 않는다. 배열 하나에서 두 표면을 만들면 갈릴 수가 없다.
 */
export function buildFaqJsonLd(
    items: readonly FaqItem[]
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
    };
}

/** 백테스팅 페이지 경로. */
export const BACKTESTING_PATH = '/backtesting';
/** 백테스팅 페이지 절대 URL. */
export const BACKTESTING_URL = `${SITE_URL}${BACKTESTING_PATH}`;
/**
 * 백테스팅 페이지 제목. 루트 레이아웃 템플릿이 브랜드 접미사(ko는 "| 시그렌즈")를
 * 붙이므로 브랜드명을 넣지 않는다(중복 방지).
 */
export function backtestingTitle(t: SeoTranslator): string {
    return t('backtesting.title');
}
/** 백테스팅 페이지 description. */
export function backtestingDescription(t: SeoTranslator): string {
    return t('backtesting.description');
}
// 루트 레이아웃이 이미 `ROOT_KEYWORDS`를 선언한다 — 하위 페이지가 그걸 다시
// 펼치면 모든 페이지가 같은 일반 키워드 뭉치를 반복 선언하게 된다.
export const BACKTESTING_KEYWORDS = [
    '주식 AI 백테스팅',
    '기술적 분석 백테스팅',
    'AI 주식 분석 백테스트',
    '기술적 분석 백테스트 결과',
    'RSI 신호 백테스팅',
    'MACD 백테스팅',
    'AI 분석 백테스트 방법론',
    'Magnificent 7 분석',
    'AI 시나리오 사후 검증',
    '기술적 분석 백테스트 무료',
    '기술적 신호 사후 검증',
    '미국 주식 백테스트',
];
