// fundamental/news 페이지 RSC 섹션의 Suspense fallback으로 공유 사용된다.
export function SectionSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="bg-secondary-700 h-32 animate-pulse rounded-xl"
        />
    );
}
