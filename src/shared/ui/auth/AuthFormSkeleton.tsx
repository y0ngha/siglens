interface AuthFormSkeletonProps {
    /** 근사할 입력 필드 행 수. 폼 높이에 맞춰 CLS를 줄이기 위한 값. */
    rows?: number;
}

/**
 * 인증 페이지가 full-static으로 prerender될 때 Suspense fallback으로 쓰인다.
 * 쿼리 의존부(폼)가 hydration 후 CSR로 채워지는 동안의 빈 화면 깜빡임을
 * 폼 레이아웃 높이를 근사한 스켈레톤으로 덮어 CLS를 최소화한다.
 */
export function AuthFormSkeleton({ rows = 2 }: AuthFormSkeletonProps) {
    return (
        <div className="space-y-4" aria-hidden="true">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <div className="bg-secondary-800 h-3 w-20 rounded motion-safe:animate-pulse" />
                    <div className="bg-secondary-800 h-10 w-full rounded-md motion-safe:animate-pulse" />
                </div>
            ))}
            <div className="bg-secondary-800 h-10 w-full rounded-md motion-safe:animate-pulse" />
        </div>
    );
}
