/**
 * @file `/news/[category]` 카테고리 탭 줄의 탭 목록.
 *
 * UI 파일이 entity `lib/`를 직접 부르지 않도록 지역 판정·경로·라벨 키를 여기서 묶는다.
 */
import {
    CATEGORY_CONFIG,
    categoriesInRegion,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';

/**
 * 탭 라벨의 메시지 키(`entities.market-news.category` 기준).
 *
 * `CATEGORY_CONFIG.labelKey`(예: "미국 일반 시장")는 가로 스크롤 탭에 너무 길어 탭
 * 전용 짧은 라벨을 쓴다. 키를 조립하지 않고 리터럴로 적어 카탈로그와 grep으로 맞춘다.
 */
const SHORT_LABEL_KEY: Record<NewsFeedCategoryId, string> = {
    general: 'general.shortLabel',
    stock: 'stock.shortLabel',
    crypto: 'crypto.shortLabel',
    forex: 'forex.shortLabel',
    articles: 'articles.shortLabel',
    kr: 'kr.shortLabel',
};

/** 카테고리 탭 하나. */
export interface CategoryTabItem {
    readonly category: NewsFeedCategoryId;
    readonly href: string;
    /** `entities.market-news.category` 네임스페이스 안의 라벨 키. */
    readonly labelKey: string;
    /** 현재 보고 있는 카테고리인가. 링크 대신 `aria-current` 텍스트가 된다. */
    readonly active: boolean;
}

/**
 * 활성 카테고리와 **같은 지역**의 카테고리를 선언 순서대로 돌려준다.
 *
 * 지역(미국·한국·암호화폐)은 위쪽 `RegionTabs`가 이미 고르고 있어서, 전 지역을 섞으면
 * 같은 화면에 지역 선택기가 둘 생긴다. 지역에 카테고리가 하나뿐이면 빈 배열이다:
 * 선택지가 없는 탭 하나는 정보가 0이고 세로 공간만 먹는다.
 */
export function buildCategoryTabs(
    activeCategory: NewsFeedCategoryId
): readonly CategoryTabItem[] {
    const siblings = categoriesInRegion(CATEGORY_CONFIG[activeCategory].region);
    if (siblings.length < 2) return [];
    return siblings.map(category => ({
        category,
        href: `/news/${CATEGORY_CONFIG[category].slug}`,
        labelKey: SHORT_LABEL_KEY[category],
        active: category === activeCategory,
    }));
}
