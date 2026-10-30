import { SITE_NAME, SITE_NAME_KO } from '@/shared/config/brand';
import {
    clampSeoDescription,
    clampSeoTitle,
    seoTitleWidth,
    SEO_TITLE_MAX_WIDTH,
    type SeoTranslator,
} from '@/shared/lib/seo';

/**
 * 레이아웃 template이 뒤에 붙이는 사이트 접미사의 폭. **예산에서 먼저 뺀다.**
 *
 * 이걸 빼지 않으면 `clampSeoTitle`이 접미사 없는 문자열을 재는데 실제 SERP에 나가는
 * 것은 접미사가 붙은 쪽이라 상한 검사가 무의미해진다. 접미사는 로케일마다 다르고
 * (`brandTitle`: ko `| 시그렌즈`, 그 외 `| SIGLENS`) 제목 빌더는 로케일을 받지 않으므로
 * 넓은 쪽으로 예산을 잡는다.
 */
const SITE_SUFFIX_WIDTH = Math.max(
    seoTitleWidth(` | ${SITE_NAME}`),
    seoTitleWidth(` | ${SITE_NAME_KO}`)
);

/**
 * 카테고리 페이지 제목의 단일 소스 — `generateMetadata`와 JSON-LD WebPage가 함께 써서
 * `metadata.title`·`og:title`·schema.org `name`이 항상 같다.
 *
 * `label`은 호출부가 이미 로케일에 맞게 번역한 카테고리명이다(`CATEGORY_CONFIG.labelKey`).
 */
export function buildCategoryPageTitle(
    label: string,
    t: SeoTranslator
): string {
    // 라벨 길이가 카테고리마다 달라(`미국 마켓 아티클` vs `미국 주식`) 꼬리표는 짧게 두고,
    // 더 긴 라벨이 붙어도 통째로 넘치지 않게 clamp로 자른다.
    return clampSeoTitle(
        t('newsCategory.titleTemplate', { label }),
        SEO_TITLE_MAX_WIDTH - SITE_SUFFIX_WIDTH
    );
}

/**
 * 카테고리 페이지 설명의 단일 소스. 여기서 `clampSeoDescription`을 거쳐 metadata·JSON-LD가
 * 같은 잘린 형태를 받는다.
 *
 * **앞머리는 카테고리 고유 소개 문장이다**(`CATEGORY_CONFIG.descriptionKey`, 화면 본문과
 * 같은 문장). 템플릿에 라벨만 갈아 끼우면 카테고리들의 설명이 같은 문장으로 시작해 서로
 * 구분되지 않는다.
 */
export function buildCategoryPageDescription(
    categoryIntro: string,
    t: SeoTranslator
): string {
    return clampSeoDescription(
        `${categoryIntro} ${t('newsCategory.descriptionSuffix')}`
    );
}
