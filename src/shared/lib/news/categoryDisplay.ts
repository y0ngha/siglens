import type { NewsCategory } from '@y0ngha/siglens-core';

/** 화면에 내보내는 뉴스 카테고리 — `other`는 정보가 없어 뺀다. */
type DisplayableNewsCategory = Exclude<NewsCategory, 'other'>;

/**
 * 뉴스 카테고리(`NewsCategory`) 배지 표시 테이블 — `impactDisplay.ts`의 짝.
 * 종목 뉴스(`widgets/news/sections/NewsList`)와 시장 뉴스
 * (`widgets/market-news/MarketNewsCard`)가 함께 쓴다. 예전에는 두 카드가
 * `{item.category}`를 그대로 찍어서 `regulation`·`m_and_a` 같은 DB enum이 화면에
 * 새고, 로케일과도 무관했다.
 *
 * 라벨 **키**만 담는다 — `t()`는 소비 컴포넌트에서 부른다.
 *
 * `Record<DisplayableNewsCategory, string>`이 exhaustiveness 원천이다: core가
 * `NewsCategory`에 멤버를 추가하면 이 파일이 컴파일되지 않아, 새 카테고리가 조용히
 * 사라지는 일을 막는다.
 *
 * `other`는 이 표에 없다 — "기타"는 독자에게 아무것도 알려 주지 않는 라벨이라 배지를
 * 아예 그리지 않는다. DB에 남아 있을 수 있는 알 수 없는 값도 같은 취급이다.
 */
export const NEWS_CATEGORY_LABEL_KEY: Record<DisplayableNewsCategory, string> =
    {
        earnings: 'newsCategory.earnings',
        m_and_a: 'newsCategory.m_and_a',
        guidance: 'newsCategory.guidance',
        regulation: 'newsCategory.regulation',
        macro: 'newsCategory.macro',
        product: 'newsCategory.product',
    };

function isDisplayableNewsCategory(
    value: string
): value is DisplayableNewsCategory {
    // `in`은 프로토타입까지 본다(`'toString' in {}` → true) — 자기 키만 인정한다.
    return Object.hasOwn(NEWS_CATEGORY_LABEL_KEY, value);
}

/**
 * 카테고리 값 → `shared.enumLabel` 키. 그리지 않을 값(`other`·알 수 없는 값·null)은 `null`.
 */
export function newsCategoryLabelKey(category: string | null): string | null {
    if (category === null || !isDisplayableNewsCategory(category)) return null;
    return NEWS_CATEGORY_LABEL_KEY[category];
}
