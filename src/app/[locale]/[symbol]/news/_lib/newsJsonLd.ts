import type { SymbolNewsListItems } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import { SITE_NAME } from '@/shared/config/brand';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { LOCALE_HREFLANG, type Locale } from '@/shared/i18n/locales';
import { ABOUT_PATH } from '@/shared/lib/legal';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import {
    localizedAbsoluteUrl,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
} from '@/shared/lib/seo';

/**
 * 스냅샷 시각 — `Date`지만 캐시 왕복(`unstable_cache`) 뒤에는 ISO 문자열로 돌아온다.
 * 그래서 소비자는 `new Date(...)`로 한 번 정규화한다.
 */
type SnapshotTime = Date | string;

/** 뉴스 탭 `Article` 노드의 발행·수정 시각(ISO). 주장할 근거가 없으면 `null`(필드 생략). */
export interface NewsArticleDates {
    readonly datePublished: string | null;
    readonly dateModified: string | null;
}

/**
 * 뉴스 AI 요약 `Article`의 발행·수정 시각.
 *
 * - `dateModified`는 화면에 그려지는 산문이 만들어진 시각(스냅샷 `generatedAt`)이다. `WebPage`
 *   노드의 `dateModified`·sitemap `lastmod`와 같은 값이라 한 문서의 노드들이 같은 수정 시각을 말한다.
 * - `datePublished`는 이 종목의 뉴스 요약이 **처음** 만들어진 시각(`firstGeneratedAt`)이다. 값이 없는
 *   행은 모르는 발행일을 지어내지 않고 생략한다.
 * - 발행이 최종 수정보다 늦으면 발행일도 생략한다 — 스스로 모순인 마크업이고, 뉴스가 끊긴 종목에서
 *   실제로 나오는 조합이다.
 */
export function newsArticleDates(
    generatedAt: SnapshotTime | null | undefined,
    firstGeneratedAt: SnapshotTime | null | undefined
): NewsArticleDates {
    const dateModified =
        generatedAt == null ? null : new Date(generatedAt).toISOString();
    const published =
        firstGeneratedAt == null
            ? null
            : new Date(firstGeneratedAt).toISOString();
    const datePublished =
        published !== null &&
        (dateModified === null || published <= dateModified)
            ? published
            : null;
    return { datePublished, dateModified };
}

interface NewsArticleJsonLdInput {
    readonly headline: string;
    readonly description: string;
    readonly locale: Locale;
    /** 이 탭의 canonical URL(로케일 접두사 없음) — `isPartOf`가 같은 문서의 `WebPage`를 가리킨다. */
    readonly pageUrl: string;
    readonly dates: NewsArticleDates;
}

/**
 * 뉴스 탭 AI 요약의 `Article` 노드. 호출부는 화면에 산문이 실제로 그려질 때만 싣는다 — 산문이
 * 없으면 이 노드가 주장하는 "분석 기사"가 페이지에 없다.
 *
 * - `isPartOf.@id`는 `buildWebPageJsonLd`가 로케일 접두사를 붙인 값과 같아야 같은 문서의 노드를
 *   참조한다.
 * - `image`는 정적 `og-image.png`다. 파일 기반 `opengraph-image` 라우트 URL은 빌드마다
 *   `?<hash>`가 붙어, 박아 두면 schema image와 OG 메타가 어긋난다.
 * - `author`는 `/about`(누가 어떻게 만든 요약인지 설명하는 페이지)을, `publisher`는 홈을 가리킨다.
 *   둘 다 사이트 발행 주체와 같은 `@id`라 파서가 익명 Organization을 따로 만들지 않는다.
 */
export function buildNewsArticleJsonLd({
    headline,
    description,
    locale,
    pageUrl,
    dates,
}: NewsArticleJsonLdInput): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline,
        description,
        inLanguage: LOCALE_HREFLANG[locale],
        ...(dates.datePublished !== null && {
            datePublished: dates.datePublished,
        }),
        ...(dates.dateModified !== null && {
            dateModified: dates.dateModified,
        }),
        isPartOf: {
            '@type': 'WebPage',
            '@id': `${localizedAbsoluteUrl(pageUrl, locale)}#webpage`,
        },
        image: [`${SITE_URL}/og-image.png`],
        author: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
            name: SITE_NAME,
            url: `${SITE_URL}${ABOUT_PATH}`,
        },
        publisher: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/icon512.png`,
            },
        },
    };
}

/**
 * 뉴스 목록 `ItemList` 노드. 목록이 비면 `null`(노드 생략).
 *
 * 초기 DOM에 실제로 그려지는 카드 수(`NEWS_LIST_PAGE_SIZE`)로 자른다 — "더보기"로 늘어난 카드는
 * 클라이언트 상태에만 있어 크롤러가 보지 못한다. 항목은 `NewsArticle`로 선언하지 않는다: `url`은
 * 외부 매체의 기사이고 우리는 제목만 번역했으므로, 위치·URL·이름까지만 말한다.
 */
export function buildNewsListJsonLd(
    items: SymbolNewsListItems,
    name: string,
    locale: Locale
): Record<string, unknown> | null {
    if (items.length === 0) return null;
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        itemListElement: items
            .slice(0, NEWS_LIST_PAGE_SIZE)
            .map((item, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                url: item.url,
                name: resolveNewsTitle(item, locale),
            })),
    };
}
