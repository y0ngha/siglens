/**
 * 종목 서브탭 섹션 하나의 Suspense fallback 카드.
 */
/** 섹션 카드 높이(`h-32`)의 장식용 펄스 블록. 보조기술에는 숨긴다. */
export function SectionSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="h-32 w-full max-w-full animate-pulse rounded-lg bg-secondary-700 motion-reduce:animate-none"
        />
    );
}
