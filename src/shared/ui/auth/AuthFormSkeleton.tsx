import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_CARD } from '@/shared/lib/surfaceStyles';

interface AuthFormSkeletonProps {
    /** 근사할 입력 필드 행 수. 폼 높이에 맞춰 CLS를 줄이기 위한 값. */
    rows?: number;
    /**
     * 폼 위에 소셜 버튼·안내·구분선·단계 안내가 먼저 오는 화면(가입 화면)용. 실제 블록과 같은 높이로
     * 자리를 그려 폼이 채워질 때 아래 내용이 밀리지 않게 한다(CLS). 제출 버튼 높이도 h-12로 바뀐다.
     */
    leadingAction?: boolean;
}

/**
 * 인증 페이지가 full-static으로 prerender될 때 Suspense fallback으로 쓰인다.
 * 쿼리 의존부(폼)가 hydration 후 CSR로 채워지는 동안의 빈 화면 깜빡임을
 * 폼 레이아웃 높이를 근사한 스켈레톤으로 덮어 CLS를 최소화한다.
 *
 * 이 스켈레톤은 `AuthCardShell`의 **카드 위**에 놓인다. 카드 표면과 같은
 * `bg-secondary-800`은 1.00:1이라 아무것도 보이지 않으므로, 표면에 맞는 자리표시자
 * 토큰을 쓴다(카드 면 위 1.218:1 다크 / 1.175:1 라이트 — `surfaceStyles.ts` 표).
 */
export function AuthFormSkeleton({
    rows = 2,
    leadingAction = false,
}: AuthFormSkeletonProps) {
    return (
        <div className="space-y-4" aria-hidden="true">
            {leadingAction ? (
                <>
                    {/* 실제 블록과 같은 높이: Google 버튼(h-12) + 안내 한 줄(mt-2 h-4). */}
                    <div>
                        <div
                            className={cn(
                                'h-12 w-full rounded-lg motion-safe:animate-pulse',
                                PLACEHOLDER_ON_CARD
                            )}
                        />
                        <div
                            className={cn(
                                'mt-2 h-4 w-3/4 rounded motion-safe:animate-pulse',
                                PLACEHOLDER_ON_CARD
                            )}
                        />
                    </div>
                    {/* "또는 이메일로 가입" 구분선 줄(my-6 h-4)과 단계 안내 한 줄(h-4). */}
                    <div className="my-6 flex h-4 items-center">
                        <span className="h-px flex-1 bg-secondary-700" />
                    </div>
                    <div
                        className={cn(
                            'h-4 w-24 rounded motion-safe:animate-pulse',
                            PLACEHOLDER_ON_CARD
                        )}
                    />
                </>
            ) : null}
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
                    // 가입 화면의 제출 버튼은 h-12다(`SubmitButton`). 로그인 등은 기존 h-10 그대로.
                    leadingAction ? 'h-12' : 'h-10',
                    'w-full rounded-lg motion-safe:animate-pulse',
                    PLACEHOLDER_ON_CARD
                )}
            />
        </div>
    );
}
