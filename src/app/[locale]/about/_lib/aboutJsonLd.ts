import {
    ABOUT_UPDATED_AT,
    aboutDescription,
    aboutFullTitle,
    aboutTitle,
    OPERATOR_PERSON_JSON_LD_ID,
    OPERATOR_SAME_AS,
    SITE_OPERATOR,
} from '@/shared/lib/legal';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    ORGANIZATION_JSON_LD_ID,
    type SeoTranslator,
} from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { ABOUT_PAGE_URL } from './aboutUrls';

/**
 * `/about`의 `AboutPage` 노드. `buildWebPageJsonLd`는 심볼 페이지들이 공유하는
 * 범용 WebPage 노드라, 스프레드 뒤에 `@type`을 `AboutPage`로 덮어써 좁히고
 * `mainEntity`로 홈 `Organization`(`ORGANIZATION_JSON_LD_ID`)을 가리킨다 — 이 문서가
 * 그 조직의 소개 문서임을 명시한다. `dateModified`는 화면 하단의 "마지막 업데이트"와
 * 같은 `ABOUT_UPDATED_AT`이다.
 */
export function buildAboutJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return {
        ...buildWebPageJsonLd({
            url: ABOUT_PAGE_URL,
            name: aboutFullTitle(t),
            description: aboutDescription(t),
            locale,
        }),
        '@type': 'AboutPage',
        mainEntity: { '@id': ORGANIZATION_JSON_LD_ID },
        dateModified: ABOUT_UPDATED_AT.toISOString(),
    };
}

/**
 * 운영자 `Person` 노드. `@id`가 홈 `Organization.founder`와 문자 그대로 같아야 두 노드를
 * 크롤러가 같은 개체로 묶는다 — 둘 다 `OPERATOR_PERSON_JSON_LD_ID` 상수를 공유해 오타로
 * 갈릴 여지를 없앤다. `/methodology`의 `author`도 이 `@id`를 가리킨다.
 */
export function buildAboutPersonJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': OPERATOR_PERSON_JSON_LD_ID,
        name: SITE_OPERATOR.name,
        email: `mailto:${SITE_OPERATOR.email}`,
        url: ABOUT_PAGE_URL,
        sameAs: OPERATOR_SAME_AS,
        affiliation: { '@id': ORGANIZATION_JSON_LD_ID },
    };
}

/** `/about`의 `BreadcrumbList` — 마디 이름은 화면 제목(`aboutTitle`)과 같다. */
export function buildAboutBreadcrumbJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return buildBreadcrumbJsonLd(
        [{ name: aboutTitle(t), url: ABOUT_PAGE_URL }],
        locale
    );
}
