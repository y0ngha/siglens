import {
    DEFAULT_LOCALE,
    isLocale,
    LOCALES,
    LOCALE_HREFLANG,
    LOCALE_OG,
    localePath,
    type Locale,
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
export function localeAlternates(
    locale: Locale,
    path: string,
    options: {
        canonical?: string | null;
        available?: readonly Locale[];
    } = {}
): { canonical: string | null; languages?: LanguageAlternates } {
    const canonical =
        options.canonical === undefined
            ? localeCanonical(locale, path)
            : options.canonical;
    if (canonical === null) return { canonical: null };
    const languages = buildLanguageAlternates(path, options.available);
    return Object.keys(languages).length > 0
        ? { canonical, languages }
        : { canonical };
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
    options: {
        canonical?: string | null;
        available?: readonly Locale[];
    } = {}
): Promise<{ canonical: string | null; languages?: LanguageAlternates }> {
    const { locale } = await params;
    return localeAlternates(
        isLocale(locale) ? locale : DEFAULT_LOCALE,
        path,
        options
    );
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
                : available.filter(l => l !== locale).map(l => LOCALE_OG[l]),
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
export function localeRobots(
    locale: Locale,
    base: { index: boolean; follow: boolean } = { index: true, follow: true },
    available: readonly Locale[] = STATIC_INDEXABLE_LOCALES
): { index: boolean; follow: boolean } {
    if (!base.index) return base;
    return available.includes(locale) ? base : { index: false, follow: true };
}
