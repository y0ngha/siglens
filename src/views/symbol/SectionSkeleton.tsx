/**
 * 탭 이동 골격(`SymbolTabSkeleton`)이 `SYMBOL_TAB_SECTION_COUNT`만큼 쌓는 섹션 카드 하나 — 섹션 카드
 * 높이(`h-32`)의 장식용 펄스 블록이라 보조기술에는 숨긴다.
 */
export function SectionSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="h-32 w-full max-w-full animate-pulse rounded-lg bg-secondary-700 motion-reduce:animate-none"
        />
    );
}
