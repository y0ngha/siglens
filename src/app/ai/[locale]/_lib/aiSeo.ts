import type { Metadata } from 'next';
import {
    AI_SITE_URL,
    type AiIndexablePath,
    type AiSeoCopy,
} from '@/shared/config/aiHost';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import {
    DEFAULT_LOCALE,
    LOCALES,
    LOCALE_HREFLANG,
    LOCALE_OG,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { localePageRobots } from '@/shared/lib/seoAlternates';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/config/brand';
import { brandAiName } from '@/shared/lib/brandName';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';

/**
 * JSON-LD `name`과 워드마크에 쓰는 표기 고정 제품명. 제목·`og:site_name`·화면 문구는
 * `brandAiName(locale)`을 쓴다(ko `시그렌즈 AI`, `I18N.md#I18-11`).
 */
export const AI_PRODUCT_NAME = 'SIGLENS AI';

/**
 * `locale`의 `path`를 가리키는 ai 호스트 절대 URL(`/`는 채팅 홈).
 * canonical·hreflang·JSON-LD가 같은 규칙을 쓰게 하는 단일 출처.
 */
export function aiUrl(locale: Locale, path: string): string {
    return `${AI_SITE_URL}${localePath(locale, path)}`;
}

/**
 * 랜딩(`/`)의 메타데이터. `AI_INDEXABLE_PATHS`의 공개·색인 페이지 중 하나이며 메인 사이트
 * 정적 페이지와 같은 로케일 게이트를 쓴다 — 게이트 밖 로케일은 `noindex`이고 hreflang
 * 클러스터를 내지 않는다(하나짜리 클러스터는 클러스터가 아니다).
 *
 * 대화(`/c/*`)는 여기를 지나지 않는다: 비공개·`noindex`다.
 */
export function buildAiHomeMetadata(locale: Locale, copy: AiSeoCopy): Metadata {
    return buildAiPageMetadata(locale, '/', copy);
}

/**
 * `/about` 메타데이터. 이 페이지는 SIGLENS AI가 답하는 방식을 설명해 "how it works" 질의를,
 * 홈은 "stock AI chatbot" 질의를 맡는다 — 두 페이지, 두 의도.
 */
export function buildAiAboutMetadata(
    locale: Locale,
    copy: AiSeoCopy
): Metadata {
    return buildAiPageMetadata(locale, '/about', copy);
}

/**
 * `/benchmark` 메타데이터. 정본이 이 호스트라 메인 사이트의 `/benchmark`
 * canonical이 여기를 가리킨다.
 */
export function buildAiBenchmarkMetadata(
    locale: Locale,
    copy: AiSeoCopy
): Metadata {
    return buildAiPageMetadata(locale, '/benchmark', copy);
}

/**
 * ai 호스트의 로케일별 OG 이미지. 경로 세그먼트 + `.png` — 정적화·엣지 캐시되는
 * 형태(`api/ai/og/[file]/route.tsx`).
 */
export function aiOgImageUrl(locale: Locale): string {
    return `${AI_SITE_URL}/api/ai/og/${locale}.png`;
}

/** 색인 대상 로케일만의 hreflang 맵. 색인 로케일이 하나뿐이면 클러스터를 만들지 않는다. */
function indexableLanguages(path: AiIndexablePath): Record<string, string> {
    if (STATIC_INDEXABLE_LOCALES.length <= 1) return {};
    return {
        ...Object.fromEntries(
            LOCALES.filter(l => STATIC_INDEXABLE_LOCALES.includes(l)).map(l => [
                LOCALE_HREFLANG[l],
                aiUrl(l, path),
            ])
        ),
        'x-default': aiUrl(DEFAULT_LOCALE, path),
    };
}

function buildAiPageMetadata(
    locale: Locale,
    path: AiIndexablePath,
    copy: AiSeoCopy
): Metadata {
    const languages = indexableLanguages(path);
    const image = {
        url: aiOgImageUrl(locale),
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: copy.ogLabel,
    };
    return {
        title: { absolute: copy.title },
        description: copy.description,
        applicationName: brandAiName(locale),
        alternates: {
            canonical: aiUrl(locale, path),
            ...(Object.keys(languages).length > 0 ? { languages } : {}),
        },
        // 메인 사이트와 같은 헬퍼 — 레이아웃의 `robots`를 통째로 덮으므로 구글
        // 미리보기 지시도 여기서 함께 낸다. 색인 게이트는 `STATIC_INDEXABLE_LOCALES`다.
        robots: localePageRobots(locale),
        openGraph: {
            type: 'website',
            siteName: brandAiName(locale),
            title: copy.title,
            description: copy.description,
            url: aiUrl(locale, path),
            locale: LOCALE_OG[locale],
            images: [image],
        },
        twitter: buildTwitterMetadata({
            title: copy.title,
            description: copy.description,
            images: [image.url],
        }),
    };
}

/**
 * 랜딩의 `WebApplication` JSON-LD. 공유 `Organization` `@id`로 메인 사이트의 엔티티 그래프에
 * 묶는다 — SIGLENS AI는 siglens의 제품이지 별도 발행자가 아니다.
 */
export function buildAiHomeJsonLd(
    locale: Locale,
    copy: AiSeoCopy
): Record<string, unknown> {
    const siteName = SITE_NAME.toUpperCase();
    return {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        '@id': `${aiUrl(locale, '/')}#webapplication`,
        name: AI_PRODUCT_NAME,
        alternateName: `${SITE_NAME_KO} AI`,
        description: copy.description,
        url: aiUrl(locale, '/'),
        inLanguage: LOCALE_HREFLANG[locale],
        applicationCategory: 'FinanceApplication',
        applicationSubCategory: 'Stock and crypto AI chatbot',
        operatingSystem: 'Web',
        // 다른 도메인의 `@id`만으로는 구글이 해석하지 못한다 — 이 페이지에서 의미를
        // 가지려면 노드가 자기 이름과 URL을 직접 실어야 한다.
        isPartOf: {
            '@type': 'WebSite',
            '@id': `${SITE_URL}#website`,
            name: siteName,
            url: SITE_URL,
        },
        publisher: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
            name: siteName,
            url: SITE_URL,
        },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    };
}
