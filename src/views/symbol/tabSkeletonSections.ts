/**
 * 종목 서브탭 골격이 그리는 섹션 카드 수 — 탭 본문이 섹션 카드의 세로 목록인 탭만.
 *
 * 두 곳이 같은 수를 써야 한다: 각 탭의 `loading.tsx`(직접 접속·콜드 렌더의 fallback)와
 * 탭 이동 중에 그리는 `SymbolTabSkeleton`. 따로 적어 두면 한쪽만 고쳐져 같은 탭의 골격이
 * 진입 경로에 따라 달라진다.
 */
export const SYMBOL_TAB_SECTION_COUNT = {
    overall: 3,
    news: 5,
    fundamental: 6,
    financials: 4,
    congress: 4,
    'fear-greed': 4,
    position: 3,
} as const satisfies Readonly<Record<string, number>>;

export type SectionSkeletonTab = keyof typeof SYMBOL_TAB_SECTION_COUNT;

export function isSectionSkeletonTab(tab: string): tab is SectionSkeletonTab {
    return Object.hasOwn(SYMBOL_TAB_SECTION_COUNT, tab);
}
