import {
    hasRegionForRoot,
    NAV_VERTICALS,
    type NavRegionLink,
    type NavVertical,
} from '@/shared/config/assetClassNav';
import { CATEGORY_CONFIG, categoriesInRegion } from '@/entities/market-news';

/** 지역 안에서 한 번에 갈 수 있는 최종 목적지. */
export interface NavLeafLink {
    readonly label: string;
    readonly href: string;
}

export interface NavRegionNode extends NavRegionLink {
    /**
     * 이 지역 안의 최종 목적지들. 비어 있으면 지역 링크 자체가 최종 목적지다.
     *
     * 뉴스 미국만 비어 있지 않다 — 그 지역만 카테고리가 여러 개라서다.
     */
    readonly children: readonly NavLeafLink[];
}

export interface NavVerticalNode extends Omit<NavVertical, 'regions'> {
    readonly regions: readonly NavRegionNode[];
    /**
     * 버티컬 루트가 지역 링크 어디에도 없을 때의 "전체" 항목. 없으면 `null`.
     *
     * 뉴스만 해당한다 — `/news`는 3지역 상위 허브라 지역 목록(`/news/us` 등)에
     * 들어 있지 않다. 이 항목이 없으면 **`/news`로 가는 내부 앵커가 사이트 전체에
     * 0개가 된다**(헤더 트리거는 `<button>`, 푸터·히어로는 지역만 평탄화한다).
     * 이미 순위를 가진 URL의 주제를 바꾸면서 내부 링크까지 끊는 조합이라,
     * 이 한 줄이 SEO 회귀를 막는 지점이다.
     */
    readonly overview: NavLeafLink | null;
}

/**
 * 헤더·드로어가 그리는 **2단 내비 트리**.
 *
 * `shared/config/assetClassNav`의 버티컬×지역 뼈대에, 뉴스 미국 지역만
 * `entities/market-news`의 카테고리를 자식으로 붙인다.
 *
 * **왜 여기서 합치는가**: 자식 목록의 출처(`CATEGORY_CONFIG`)는 entities에 있고
 * 뼈대(`NAV_VERTICALS`)는 shared에 있다. shared는 entities를 import할 수 없으므로
 * (FSD 의존 방향) 두 층을 다 볼 수 있는 widgets에서 합성한다. 뼈대를 entities로
 * 내리면 `shared/ui/RegionTabs`가 그걸 못 읽는다.
 *
 * **왜 2단인가**: 1단만 두면 미국 주식 뉴스에 닿기까지 헤더 → 지역 허브 → 카테고리로
 * 클릭이 두 번이다. 자산군을 1차 축으로 올린 목적이 "바로 들어가기"인데 허브를
 * 한 겹 더 만들면 오히려 멀어진다. 지역 허브 페이지는 그대로 두되(색인·푸터·사이트맵),
 * 헤더에서는 최종 목적지로 직행한다.
 */
export const NAV_TREE: readonly NavVerticalNode[] = NAV_VERTICALS.map(
    vertical => ({
        ...vertical,
        // 판정식은 `assetClassNav`가 소유한다 — 푸터(`NAV_OVERVIEW_LINKS`)와
        // 같은 규칙을 두 곳에 손으로 적어 두면 한쪽만 갱신된다.
        overview: hasRegionForRoot(vertical)
            ? null
            : { label: '전체', href: vertical.rootHref },
        regions: vertical.regions.map(region => ({
            ...region,
            children: vertical.id === 'news' ? newsLeavesOf(region.region) : [],
        })),
    })
);

/**
 * 뉴스 지역 하나의 카테고리 링크들. 카테고리가 하나뿐인 지역(한국·암호화폐)은
 * 빈 배열을 돌려준다 — 지역 링크와 똑같은 목적지 하나를 자식으로 또 그리면
 * 같은 줄이 두 번 나온다.
 */
function newsLeavesOf(region: NavRegionLink['region']): readonly NavLeafLink[] {
    const categories = categoriesInRegion(region);
    if (categories.length < 2) return [];
    return categories.map(cat => ({
        label: CATEGORY_CONFIG[cat].koLabel,
        href: `/news/${CATEGORY_CONFIG[cat].slug}`,
    }));
}
