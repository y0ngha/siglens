import { useTranslations } from 'next-intl';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={cn('animate-pulse rounded bg-secondary-700', className)}
        />
    );
}

/**
 * `AccountContent`가 세션을 읽는 동안의 Suspense fallback. 본문과 같은 섹션 순서·크기로 그려
 * 본문이 들어올 때 레이아웃이 덜 밀린다. 공개 API 출시 전에는 본문에 "시그렌즈 API" 섹션이
 * 없으므로 스켈레톤도 그리지 않는다(같은 `isPublicApiEnabled` 게이트).
 */
export function AccountContentSkeleton() {
    const t = useTranslations('app.account');
    return (
        <>
            <section
                aria-label={t('page.c4079e')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <SkeletonLine className="h-6 w-16" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                    <SkeletonLine className="h-4 w-12" />
                    <SkeletonLine className="h-4 w-48" />
                    <SkeletonLine className="h-4 w-16" />
                    <SkeletonLine className="h-4 w-24" />
                    <SkeletonLine className="h-4 w-16" />
                    <SkeletonLine className="h-4 w-16" />
                </div>
            </section>

            <section
                aria-label={t('page.1b6c6d')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <SkeletonLine className="h-6 w-32" />
                <SkeletonLine className="h-4 w-64" />
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700"
                    >
                        <div className="flex items-center gap-2">
                            <SkeletonLine className="h-4 w-20" />
                            <SkeletonLine className="h-5 w-12 rounded-full" />
                        </div>
                    </div>
                ))}
            </section>

            {isPublicApiEnabled() && (
                <section
                    aria-label={t('page.siglensApi')}
                    className={cn(SURFACE_CARD, 'space-y-4 p-6')}
                >
                    <SkeletonLine className="h-6 w-32" />
                    <SkeletonLine className="h-4 w-64" />
                    <SkeletonLine className="h-10 w-full" />
                </section>
            )}
        </>
    );
}
