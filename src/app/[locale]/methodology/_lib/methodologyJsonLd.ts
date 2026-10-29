import {
    METHODOLOGY_PATH,
    METHODOLOGY_UPDATED_AT,
    methodologyDescription,
    methodologyFullTitle,
    methodologyTitle,
    OPERATOR_PERSON_JSON_LD_ID,
} from '@/shared/lib/legal';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
    type SeoTranslator,
} from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';

/** 로케일 접두사 없는 `/methodology` 절대 URL — 메타데이터와 JSON-LD가 함께 쓴다. */
export const METHODOLOGY_PAGE_URL = `${SITE_URL}${METHODOLOGY_PATH}`;

/**
 * `/methodology`의 `WebPage` 노드. `buildWebPageJsonLd`는 심볼 페이지들이 공유하는 범용
 * 노드라, 스프레드로 세 가지를 얹는다.
 *
 *  - `dateModified`: 화면 하단의 "마지막 업데이트"와 같은 `METHODOLOGY_UPDATED_AT`
 *  - `publisher`: 홈 `Organization`을 `@id`로 가리킨다
 *  - `author`: `/about`의 `Person`(`OPERATOR_PERSON_JSON_LD_ID`)을 `@id`로 가리킨다 —
 *    노드를 여기서 다시 정의하지 않는다. 같은 개체를 두 페이지가 각자 정의하면
 *    한쪽만 고쳐져 크롤러가 둘을 다른 사람으로 읽는다.
 *
 * FAQPage는 내보내지 않는다 — 이 페이지에는 질문·답변 형식의 본문이 없다.
 */
export function buildMethodologyJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return {
        ...buildWebPageJsonLd({
            url: METHODOLOGY_PAGE_URL,
            name: methodologyFullTitle(t),
            description: methodologyDescription(t),
            locale,
        }),
        dateModified: METHODOLOGY_UPDATED_AT.toISOString(),
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
        author: { '@id': OPERATOR_PERSON_JSON_LD_ID },
    };
}

/** `/methodology`의 `BreadcrumbList` — 마디 이름은 화면 제목(`methodologyTitle`)과 같다. */
export function buildMethodologyBreadcrumbJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return buildBreadcrumbJsonLd(
        [{ name: methodologyTitle(t), url: METHODOLOGY_PAGE_URL }],
        locale
    );
}
