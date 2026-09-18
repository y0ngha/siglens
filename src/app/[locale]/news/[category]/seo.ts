import {
    clampSeoDescription,
    clampSeoTitle,
    seoTitleWidth,
    SEO_TITLE_MAX_WIDTH,
    SITE_NAME,
    type SeoTranslator,
} from '@/shared/lib/seo';

/**
 * 레이아웃 template이 뒤에 붙이는 사이트 접미사의 폭. **예산에서 먼저 뺀다.**
 *
 * 이걸 빼지 않으면 `clampSeoTitle`이 접미사 없는 문자열을 재고, 실제 SERP에 나가는
 * 것은 접미사가 붙은 쪽이라 가드가 통째로 무의미해진다 — 옛 꼬리표로 만든
 * `한국 증시 뉴스 — 최신 시장 흐름과 AI 다이제스트`는 그 자체로는 47이라 상한 55를
 * 통과하지만, `| Siglens`(폭 10)까지 더하면 57로 넘는다.
 */
const SITE_SUFFIX_WIDTH = seoTitleWidth(` | ${SITE_NAME}`);

/**
 * Single source for the category page title string.
 * Used by both `generateMetadata` and the JSON-LD WebPage block so that
 * metadata.title, og.title, and schema.org name are always identical.
 *
 * `label`은 호출부가 이미 로케일에 맞게 번역한 카테고리명이다
 * (`entities.market-news.category.<id>.label` — `CATEGORY_CONFIG.labelKey`).
 */
export function buildCategoryPageTitle(
    label: string,
    t: SeoTranslator
): string {
    /*
     * 꼬리표를 `— 최신 시장 흐름과 AI 다이제스트`에서 줄였다.
     *
     * 라벨 길이가 카테고리마다 달라서(`미국 마켓 아티클` vs `미국 주식`) 긴 꼬리표를
     * 붙이면 폭 예산을 넘는 조합이 생긴다. 실측(접미사 `| Siglens` 포함):
     * 옛 꼬리표는 6개 카테고리가 56~64로 **전부** 상한 55를 넘었고, 지금은 45~53이다.
     *
     * clamp도 남겨 둔다 — 나중에 라벨이 더 긴 카테고리가 붙어도 잘려 나가지
     * 통째로 넘치지는 않게.
     */
    return clampSeoTitle(
        t('newsCategory.titleTemplate', { label }),
        SEO_TITLE_MAX_WIDTH - SITE_SUFFIX_WIDTH
    );
}

/**
 * Single source for the category page description.
 * `clampSeoDescription` is applied here so every consumer (metadata, JSON-LD)
 * receives the already-clamped form — no risk of differing truncation.
 *
 * **앞머리는 카테고리 고유 문장이다.** 예전에는 템플릿 하나에 라벨만 갈아 끼워서
 * 색인 대상 5개의 설명이 사실상 같았다(2026-09-18 운영 실측: `{라벨} 분야의 최신
 * 뉴스를…`로 시작하는 문장이 5개 카테고리에 동일). 화면 본문이 이미 카테고리마다
 * 다른 소개 문장(`CATEGORY_CONFIG.descriptionKey`)을 네 로케일로 갖고 있으므로,
 * 새 문구를 쓰지 않고 그것을 앞에 둔다 — 설명이 서로 달라지고, 화면과 메타가 같은
 * 말을 하게 된다.
 */
export function buildCategoryPageDescription(
    categoryIntro: string,
    t: SeoTranslator
): string {
    return clampSeoDescription(
        `${categoryIntro} ${t('newsCategory.descriptionSuffix')}`
    );
}
