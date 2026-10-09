import type {
    GuideCategory,
    GuideEntry,
    GuideEntrySummary,
} from '@/entities/guide/types';
import {
    DEFAULT_LOCALE,
    LOCALE_HREFLANG,
    type Locale,
} from '@/shared/i18n/locales';
import { OPERATOR_PERSON_JSON_LD_ID } from '@/shared/lib/legal';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    localizedAbsoluteUrl,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
    type FaqItem,
} from '@/shared/lib/seo';
import {
    GUIDE_PATH,
    guideCategoryPath,
    guideEntryPath,
} from '@/shared/lib/guidePaths';

const WEBSITE_REF = { '@type': 'WebSite', '@id': `${SITE_URL}#website` };

function absoluteGuideUrl(path: string, locale: Locale): string {
    return localizedAbsoluteUrl(`${SITE_URL}${path}`, locale);
}

interface CollectionInput {
    readonly locale: Locale;
    /** 로케일 접두사 없는 경로(`/guide`, `/guide/indicators`). */
    readonly path: string;
    readonly name: string;
    readonly description: string;
    readonly entries: readonly GuideEntrySummary[];
}

/**
 * 허브·분류 허브의 `CollectionPage` + `ItemList`. 목록의 `name`은 카드에 보이는 제목이다.
 * 항목 `url`은 로케일을 따르므로 `/en/guide/...`의 목록이 ko URL을 가리키지 않는다.
 */
export function buildGuideCollectionJsonLd({
    locale,
    path,
    name,
    description,
    entries,
}: CollectionInput): Record<string, unknown> {
    const url = absoluteGuideUrl(path, locale);
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        name,
        description,
        url,
        inLanguage: LOCALE_HREFLANG[locale],
        isPartOf: WEBSITE_REF,
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: entries.length,
            itemListElement: entries.map((entry, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: entry.title,
                url: absoluteGuideUrl(
                    guideEntryPath(entry.category, entry.slug),
                    locale
                ),
            })),
        },
    };
}

interface ArticleInput {
    readonly locale: Locale;
    readonly entry: GuideEntry;
}

/**
 * 항목의 `TechArticle`. `dateModified`는 화면 하단 "마지막 업데이트"와 같은 `updatedAt`이다.
 * 첫 발행 시각을 모르므로 `datePublished`는 내지 않는다(요청·빌드 시각으로 채우면 거짓이 된다).
 *
 * `inLanguage`는 **실제로 보여 주는 본문의 언어**다 — 번역이 없어 ko로 대신한 렌더가
 * `en`을 자처하지 않게 한다.
 */
export function buildGuideArticleJsonLd({
    locale,
    entry,
}: ArticleInput): Record<string, unknown> {
    const url = absoluteGuideUrl(
        guideEntryPath(entry.category, entry.slug),
        locale
    );
    const bodyLocale = entry.isFallback ? DEFAULT_LOCALE : locale;
    return {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        '@id': `${url}#article`,
        headline: entry.title,
        description: entry.seoDescription,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: LOCALE_HREFLANG[bodyLocale],
        dateModified: entry.updatedAt,
        isPartOf: WEBSITE_REF,
        author: { '@id': OPERATOR_PERSON_JSON_LD_ID },
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
    };
}

interface BreadcrumbInput {
    readonly locale: Locale;
    readonly hubTitle: string;
    /** 분류 허브면 그 분류, 항목이면 항목이 속한 분류. 허브 자체면 없다. */
    readonly category?: { id: GuideCategory; label: string };
    readonly entryTitle?: string;
    readonly entrySlug?: string;
}

/**
 * 가이드 브레드크럼. 이름은 화면의 `Breadcrumb`에 보이는 글자와 같아야 한다
 * (`buildBreadcrumbJsonLd` JSDoc) — 뷰와 라우트가 같은 문자열을 넘기는 것이 계약이다.
 */
export function buildGuideBreadcrumbJsonLd({
    locale,
    hubTitle,
    category,
    entryTitle,
    entrySlug,
}: BreadcrumbInput): Record<string, unknown> {
    const categoryTrail =
        category === undefined
            ? []
            : [
                  {
                      name: category.label,
                      url: guideCategoryPath(category.id),
                  },
                  ...(entryTitle !== undefined && entrySlug !== undefined
                      ? [
                            {
                                name: entryTitle,
                                url: guideEntryPath(category.id, entrySlug),
                            },
                        ]
                      : []),
              ];
    const trail = [{ name: hubTitle, url: GUIDE_PATH }, ...categoryTrail];
    return buildBreadcrumbJsonLd(trail, locale);
}

/** 화면에 보이는 FAQ와 같은 배열로 `FAQPage`를 만든다. 비어 있으면 `null`이다. */
export function buildGuideFaqJsonLd(
    faq: GuideEntry['faq']
): Record<string, unknown> | null {
    if (faq.length === 0) return null;
    const items: FaqItem[] = faq.map(({ q, a }) => ({
        question: q,
        answer: a,
    }));
    return buildFaqJsonLd(items);
}
