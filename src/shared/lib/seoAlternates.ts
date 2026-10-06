import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { SITE_NAME } from '@/shared/lib/seo';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import type { Metadata } from 'next';
import {
    DEFAULT_LOCALE,
    LOCALES,
    LOCALE_HREFLANG,
    LOCALE_OG,
    localePath,
    type Locale,
    resolveLocale,
} from '@/shared/i18n/locales';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { SITE_URL } from '@/shared/lib/seo';

/** `Metadata['alternates']['languages']`에 그대로 넣을 수 있는 형태. */
export type LanguageAlternates = Record<string, string>;

/**
 * hreflang alternates를 만든다.
 *
 * **상호 참조가 규칙이다** — en 페이지도 ko/ja/zh를 전부 선언해야 Google이 묶음을
 * 인정한다. 한쪽만 선언하면 hreflang이 통째로 무시되고 각 URL이 독립 중복 콘텐츠가
 * 된다. 그래서 이 함수는 항상 전체 집합을 만들고, 제외는 `available` 인자로만 한다.
 *
 * `x-default`는 기본 로케일(ko)을 가리킨다.
 *
 * 준비된 로케일이 **하나뿐이면 빈 객체**를 돌려준다. 자기 자신만 가리키는
 * hreflang은 아무 정보도 주지 않으면서 색인된 전 페이지의 HTML을 바꾼다.
 * 두 번째 로케일이 준비되는 순간 전 페이지가 한꺼번에 hreflang을 갖는다.
 *
 * @param path      로케일 접두사가 없는 경로(`/`, `/AAPL`, `/news/us`)
 * @param available 콘텐츠가 실제로 준비된 로케일. 미번역 로케일을 광고하면
 *                  thin content로 색인돼 2026-07 노출 붕괴가 재현된다.
 *                  기본값은 정적 페이지 기준 준비 로케일.
 */
export function buildLanguageAlternates(
    path: string,
    available: readonly Locale[] = STATIC_INDEXABLE_LOCALES
): LanguageAlternates {
    if (available.length < 2) return {};
    const languages: LanguageAlternates = {};
    for (const locale of LOCALES) {
        if (!available.includes(locale)) continue;
        languages[LOCALE_HREFLANG[locale]] =
            `${SITE_URL}${localePath(locale, path)}`;
    }
    if (available.includes(DEFAULT_LOCALE)) {
        languages['x-default'] =
            `${SITE_URL}${localePath(DEFAULT_LOCALE, path)}`;
    }
    return languages;
}

/** 해당 로케일 페이지의 자기참조 canonical. hreflang이 성립하려면 자기 자신이어야 한다. */
export function localeCanonical(locale: Locale, path: string): string {
    return `${SITE_URL}${localePath(locale, path)}`;
}

/**
 * 색인하지 않는(noindex) 렌더의 alternates — **자기 URL canonical만** 내고 hreflang 군집
 * (`languages`)·발견 링크(`types`)는 싣지 않는다.
 *
 * `canonical: null`로 비우면 신호가 사라져 크롤러가 URL 군집을 스스로 추정한다. 종목 탭의
 * noindex 분기(`noindexSymbolMetadata`)·항상-noindex 탭과 같은 self-canonical 정책이다.
 * 색인되지 않는 URL을 대체 언어로 광고할 이유는 없으므로 `languages`는 뺀다.
 */
export function selfCanonicalAlternates(
    locale: Locale,
    path: string
): LocaleAlternatesResult {
    return { canonical: localeCanonical(locale, path) };
}

/**
 * 페이지 `metadata.alternates`를 통째로 만든다.
 *
 * ⚠️ **hreflang은 반드시 페이지마다 선언해야 한다.** Next.js는 세그먼트 간
 * 메타데이터를 최상위 키 단위로 **교체**한다 — 레이아웃이 `alternates.languages`를
 * 선언해도 페이지가 `alternates: { canonical }`을 선언하는 순간 languages가 통째로
 * 사라진다. 실측에서 전 페이지의 hreflang이 0개였다(빌드·타입체크는 통과).
 *
 * canonical이 `null`이면(noindex 또는 degraded 폴백) hreflang을 붙이지 않는다 —
 * 색인되지 않는 URL을 대체 언어로 광고하면 크롤 예산만 태운다.
 *
 * @param canonical 명시하지 않으면 `path`의 자기참조 canonical을 쓴다.
 *                  `null`을 명시하면 canonical·hreflang을 모두 생략한다.
 * @param available 콘텐츠가 준비된 로케일. 미번역 로케일을 광고하면 thin content로
 *                  색인된다.
 */
/** `Metadata['alternates']`에 그대로 넣는 형태. */
export interface LocaleAlternatesResult {
    readonly canonical: string | null;
    readonly languages?: LanguageAlternates;
    /** `<link rel="alternate" type=…>` 발견 링크(RSS 등). 옵션으로 줬을 때만 나간다. */
    readonly types?: Readonly<Record<string, string>>;
}

/** `localeAlternates`·`localeAlternatesFrom`가 공유하는 선택 인자. */
export interface LocaleAlternatesOptions {
    readonly canonical?: string | null;
    readonly available?: readonly Locale[];
    /**
     * 발견 링크(`types`). 페이지가 `alternates`를 선언하면 레이아웃의 `types`는 교체돼
     * 사라지므로(위 hreflang과 같은 규칙) 필요한 페이지가 여기로 넘긴다. canonical이
     * `null`인 noindex 분기에는 붙이지 않는다.
     */
    readonly types?: Readonly<Record<string, string>>;
}

export function localeAlternates(
    locale: Locale,
    path: string,
    options: LocaleAlternatesOptions = {}
): LocaleAlternatesResult {
    const canonical =
        options.canonical === undefined
            ? localeCanonical(locale, path)
            : options.canonical;
    if (canonical === null) return { canonical: null };
    /**
     * **자기 자신이 준비 집합에 없으면 클러스터를 선언하지 않는다.**
     *
     * hreflang은 상호 참조가 성립해야 인정된다 — 자기를 뺀 묶음을 광고하면
     * Google은 그 클러스터를 통째로 버리고, 이 URL은 self-canonical만 남은 채
     * 중복 후보로 남는다. `localeRobots`가 이런 로케일을 noindex로 내리므로
     * 지금은 `available`이 ko 하나뿐이라 드러나지 않지만, `STATIC_INDEXABLE_LOCALES`에
     * 두 번째 로케일을 넣는 순간 준비되지 않은 나머지 두 로케일에서 바로 난다.
     */
    const available = options.available ?? STATIC_INDEXABLE_LOCALES;
    const types = options.types === undefined ? {} : { types: options.types };
    if (!available.includes(locale)) return { canonical, ...types };
    const languages = buildLanguageAlternates(path, available);
    return Object.keys(languages).length > 0
        ? { canonical, languages, ...types }
        : { canonical, ...types };
}

/**
 * `generateMetadata`의 `params`에서 로케일을 읽어 alternates를 만든다.
 *
 * 페이지마다 `const { locale } = await params` + 검증을 반복하지 않기 위한 래퍼다.
 * 로케일이 유효하지 않으면 기본 로케일로 떨어뜨린다 — 이 시점에 던지면 메타데이터
 * 생성 실패로 5xx가 되는데, 봇에게 5xx는 404보다 나쁘다.
 */
export async function localeAlternatesFrom(
    params: Promise<{ locale: string }>,
    path: string,
    options: LocaleAlternatesOptions = {}
): Promise<LocaleAlternatesResult> {
    const { locale } = await params;
    return localeAlternates(resolveLocale(locale), path, options);
}

/**
 * 페이지 `openGraph`에 스프레드할 로케일 필드.
 *
 * ⚠️ hreflang과 같은 이유로 **페이지마다 선언해야 한다** — 페이지가 `openGraph`를
 * 선언하는 순간 레이아웃의 `openGraph.locale`이 통째로 사라져 모든 로케일 페이지가
 * `og:locale`을 잃는다.
 */
export function localeOpenGraph(
    locale: Locale,
    available: readonly Locale[] = STATIC_INDEXABLE_LOCALES
): {
    locale: string;
    alternateLocale: string[];
} {
    return {
        locale: LOCALE_OG[locale],
        // 색인 게이트를 통과한 로케일만 대체본으로 광고한다. 전 로케일을
        // 무조건 나열하면 hreflang에서 걷어낸 것과 같은 문제 — 아직 준비되지
        // 않은 로케일을 외부에 광고 — 를 og 계층에서 반복한다.
        // hreflang과 같은 게이트: 색인 가능한 로케일이 하나뿐이면 클러스터가
        // 성립하지 않으므로 대체본을 광고하지 않는다(`buildLanguageAlternates`
        // 가 `{}`를 돌려주는 것과 같은 조건).
        alternateLocale:
            available.length < 2
                ? []
                : available.flatMap(l => (l === locale ? [] : [LOCALE_OG[l]])),
    };
}

/**
 * 로케일 색인 게이트를 적용한 `robots`.
 *
 * ## 왜 필요한가
 *
 * `STATIC_INDEXABLE_LOCALES`는 hreflang·sitemap alternates만 움직였고 `robots`는
 * 건드리지 않았다. 그래서 `/terms`·`/en/terms`·`/ja/terms`·`/zh/terms`가 전부
 * **각자 자기 자신을 canonical로 걸고 index:true**로 나갔다 — 제목·설명은 아직
 * 한국어(`shared/lib/seo.ts`는 미추출 문자열 1,649개 중 229개), 약관·정책 본문은
 * DB의 한국어 원문. 2026-07 thin/duplicate content 붕괴와 정확히 같은 모양이
 * 언어 3개로 복제된다.
 *
 * 게이트를 통과하지 못한 로케일은 `follow: true`를 유지한 채 noindex다 —
 * 링크는 계속 따라가되 색인만 막는다.
 */
/** `Metadata['robots']`의 색인 지시 두 축. */
export interface RobotsDirective {
    readonly index: boolean;
    readonly follow: boolean;
}

export function localeRobots(
    locale: Locale,
    base: RobotsDirective = { index: true, follow: true },
    available: readonly Locale[] = STATIC_INDEXABLE_LOCALES
): RobotsDirective {
    if (!base.index) return base;
    return available.includes(locale) ? base : { index: false, follow: true };
}

/**
 * 구글 결과 미리보기 지시 — 큰 이미지 썸네일, 스니펫·동영상 미리보기 길이 무제한.
 * 이 지시가 빠지면 구글은 기본값(작은 썸네일 등)을 쓴다.
 */
const GOOGLE_PREVIEW_DIRECTIVES = {
    'max-video-preview': -1,
    'max-image-preview': 'large',
    'max-snippet': -1,
} as const;

/**
 * 페이지 `metadata.robots`에 **그대로** 넣는 값 — 로케일 색인 게이트
 * (`localeRobots`)와 구글 미리보기 지시를 함께 담는다.
 *
 * **왜 따로 있는가**: Next는 `robots` 키를 부모와 병합하지 않고 통째로 교체한다.
 * 루트 레이아웃이 `googleBot` 미리보기 지시를 선언해도, ko만 색인하려고
 * `robots: localeRobots(locale)`를 직접 선언한 페이지(허브·소개·분석 방법·약관…)는
 * `{ index, follow }`만 남고 미리보기 지시를 잃었다(2026-10-04 운영 실측: `/market`,
 * `/fear-greed`, `/economy`, `/news`, `/about`, `/methodology`, `/symbols`의
 * robots 메타가 `index, follow` 한 줄뿐). 레이아웃과 페이지가 이 함수 하나를 쓰면
 * 두 표면이 갈리지 않는다.
 *
 * `googleBot`도 색인 판정을 그대로 따른다 — 미리보기 지시만 얹고 noindex를 뒤집지 않는다.
 */
export function localePageRobots(
    locale: Locale,
    base?: RobotsDirective,
    available?: readonly Locale[]
): NonNullable<Metadata['robots']> {
    const directive = localeRobots(locale, base, available);
    return {
        ...directive,
        googleBot: { ...directive, ...GOOGLE_PREVIEW_DIRECTIVES },
    };
}

/**
 * 단순 라우트(로그인·가입·계정 등)의 `openGraph`/`twitter`를 **통째로** 만든다.
 *
 * Next는 이 최상위 키를 부모와 **병합하지 않고 교체**한다. 그래서
 * `openGraph: { url }`만 선언하면 레이아웃의 `type`·`siteName`·`locale`·
 * `images`가 전부 사라진다 — 공유 카드에 미리보기 이미지가 없어지고,
 * `twitter`를 선언하지 않으면 레이아웃의 한국어 카드가 영어 `<title>` 밑에
 * 그대로 남는다.
 *
 * 이 결함은 세 번 났다(홈 2회, 인증 라우트 7개 1회). 라우트마다 손으로
 * 채우는 대신 여기서 한 번에 만든다 — 빠뜨릴 필드가 없어야 다시 안 난다.
 */
/** 소셜 카드 문구. 두 곳(`openGraph`·`twitter`)에 같은 값이 들어간다. */
export interface SocialCopy {
    readonly title: string;
    readonly description: string;
}

export interface LocalePageSocial {
    openGraph: NonNullable<Metadata['openGraph']>;
    twitter: NonNullable<Metadata['twitter']>;
}

export function localePageSocial(
    locale: Locale,
    path: string,
    { title, description }: SocialCopy
): LocalePageSocial {
    const url = localeCanonical(locale, path);
    return {
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title,
            description,
            url,
            ...localeOpenGraph(locale),
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: title,
                },
            ],
        },
        twitter: buildTwitterMetadata({
            title,
            description,
            images: ['/og-image.png'],
        }),
    };
}

/** {@link buildHubMetadata} 입력. */
export interface HubMetadataInput {
    /** `localeAlternatesFrom`에 그대로 넘긴다(라우트의 `params`). */
    readonly params: Promise<{ locale: string }>;
    readonly locale: Locale;
    /** 로케일 접두사가 없는 경로(`/market`, `/economy/kr`). */
    readonly path: string;
    /** 브랜드 없는 제목 — `<title>`은 레이아웃 템플릿이, 소셜 카드는 여기서 `| Siglens`를 붙인다. */
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
    /**
     * 본문이 빈 렌더(외부 데이터 실패·표본 부족)로 떨어졌는지. **본문과 같은 술어**를
     * 넘겨야 degrade와 noindex가 어긋나지 않는다.
     */
    readonly degraded: boolean;
    /**
     * `<link rel="alternate" type=…>` 발견 링크(RSS 등). 호출부가 `rssAlternateTypes(locale)`를
     * 넘긴다 — 여기서 `rssFeed`를 import하면 `seo` ↔ `seoAlternates` 순환에 `SITE_URL`을
     * 모듈 평가 시점에 읽는 모듈이 끼어 로드 순서에 따라 TDZ 오류가 난다.
     */
    readonly alternateTypes?: LocaleAlternatesOptions['types'];
}

/**
 * 데이터 허브 페이지(`/economy*`·`/market*`·`/fear-greed*`)의 메타데이터.
 *
 * 일곱 라우트가 같은 골격을 손으로 반복하고 있었다:
 *
 * - degraded면 `noindex, follow` + self-canonical(hreflang 없음, `selfCanonicalAlternates`) —
 *   임시 상태를 색인시키지 않되 링크 주스는 내부 링크로 계속 흐르게 한다. canonical을
 *   `null`로 비우면 신호가 사라져 크롤러가 군집을 추정한다.
 * - 정상이면 canonical은 **넘기지 않는다** — `localeAlternatesFrom`이 로케일별
 *   자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를 canonical로
 *   가리켜 hreflang 상호참조가 깨진다.
 * - 소셜 카드는 `localePageSocial`로 **통째로** 선언한다(부분 선언 시 레이아웃의
 *   `images`·`locale`이 사라진다 — `localePageSocial` 참조).
 */
export async function buildHubMetadata({
    params,
    locale,
    path,
    title,
    description,
    keywords,
    degraded,
    alternateTypes,
}: HubMetadataInput): Promise<Metadata> {
    return {
        title,
        description,
        keywords: [...keywords],
        alternates: degraded
            ? selfCanonicalAlternates(locale, path)
            : await localeAlternatesFrom(params, path, {
                  types: alternateTypes,
              }),
        robots: degraded
            ? { index: false, follow: true }
            : localePageRobots(locale),
        ...localePageSocial(locale, path, {
            title: `${title} | ${SITE_NAME}`,
            description,
        }),
    };
}
