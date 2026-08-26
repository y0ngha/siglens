import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_CARD } from '@/shared/lib/surfaceStyles';

interface AuthFormSkeletonProps {
    /** 근사할 입력 필드 행 수. 폼 높이에 맞춰 CLS를 줄이기 위한 값. */
    rows?: number;
}

/**
 * 인증 페이지가 full-static으로 prerender될 때 Suspense fallback으로 쓰인다.
 * 쿼리 의존부(폼)가 hydration 후 CSR로 채워지는 동안의 빈 화면 깜빡임을
 * 폼 레이아웃 높이를 근사한 스켈레톤으로 덮어 CLS를 최소화한다.
 *
 * 이 스켈레톤은 `AuthCardShell`의 **카드 위**에 놓인다. 한때 `bg-secondary-800`
 * 이었는데 그 값이 곧 카드 표면이라 1.00:1로 아무것도 안 보였다 — 로그인·가입·
 * 비밀번호 재설정의 로딩 화면이 통째로 빈 카드였다. 표면에 맞는 자리표시자
 * 토큰을 쓴다(카드 위 1.336:1 다크 / 1.227:1 라이트).
 */
export function AuthFormSkeleton({ rows = 2 }: AuthFormSkeletonProps) {
    return (
        <div className="space-y-4" aria-hidden="true">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <div
                        className={cn(
                            'h-3 w-20 rounded motion-safe:animate-pulse',
                            PLACEHOLDER_ON_CARD
                        )}
                    />
                    <div
                        className={cn(
                            'h-10 w-full rounded-lg motion-safe:animate-pulse',
                            PLACEHOLDER_ON_CARD
                        )}
                    />
                </div>
            ))}
            <div
                className={cn(
                    'h-10 w-full rounded-lg motion-safe:animate-pulse',
                    PLACEHOLDER_ON_CARD
                )}
            />
        </div>
    );
}
