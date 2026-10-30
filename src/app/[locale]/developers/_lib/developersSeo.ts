import { DEVELOPERS_UPDATED_AT } from '@/shared/config/publicApi';
import {
    buildWebPageJsonLd,
    ORGANIZATION_JSON_LD_ID,
    type SeoTranslator,
} from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { DEVELOPERS_PAGE_URL } from './developersUrls';

/**
 * `<title>`·OG 제목. `/methodology`와 같은 이유로 레이아웃 템플릿(`%s | 시그렌즈`)을 타지 않는다 —
 * 카탈로그 문구가 이미 브랜드로 시작하므로 호출 쪽이 `absolute`로 끊는다.
 */
export function developersFullTitle(t: SeoTranslator): string {
    return t('developers.metaTitle');
}

/**
 * `WebPage` 하나다. 이 페이지에는 질문·답변 형식의 본문이 없어 FAQPage를 내지 않고, API 문서라는 이유로
 * `TechArticle`·`APIReference` 같은 더 좁은 타입을 얹지도 않는다 — 본문이 지키지 못하는 약속이 되고
 * 이미 `WebPage`가 덮는다. `dateModified`는 화면 하단의 "마지막 업데이트"와 같은 상수다.
 */
export function buildDevelopersJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return {
        ...buildWebPageJsonLd({
            url: DEVELOPERS_PAGE_URL,
            name: developersFullTitle(t),
            description: t('developers.description'),
            locale,
        }),
        dateModified: DEVELOPERS_UPDATED_AT.toISOString(),
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
    };
}
