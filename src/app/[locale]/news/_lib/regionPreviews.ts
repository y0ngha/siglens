import {
    categoriesInRegion,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import type { NavRegionId } from '@/shared/config/assetClassNav';

/**
 * `/news` 지역 카드가 미리보기를 읽을 카테고리 — 그 지역의 **첫 카테고리**, 단 미국은 `stock`.
 *
 * 미국의 선언 순서상 첫 항목은 `general`이고 `/news/us` 카테고리 목록의 첫 카드도
 * `general`이라, 그대로 두면 허브 카드와 `/news/us` 첫 카드가 같은 피드를 미리보기로
 * 중복 노출한다(thin/duplicate content). 한국·암호화폐는 카테고리가 하나뿐이다.
 * 지역에 카테고리가 하나도 없으면 설정 결함이라 던진다.
 */
export function previewCategoryOf(region: NavRegionId): NewsFeedCategoryId {
    if (region === 'us') return 'stock';
    const first = categoriesInRegion(region)[0];
    if (first === undefined) {
        throw new Error(`[NewsHubPage] region has no categories: ${region}`);
    }
    return first;
}

/**
 * 허브의 미리보기가 **전부** 비었는가 — 메타데이터의 noindex와 본문의 구조화데이터 생략이
 * 같은 술어를 보게 하는 단일 소스. 비어 있으면 본문이 제목·설명뿐인 thin 분량이다.
 */
export function allPreviewsEmpty(
    previews: readonly (readonly string[])[]
): boolean {
    return previews.every(list => list.length === 0);
}
