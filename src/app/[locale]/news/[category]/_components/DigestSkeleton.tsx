import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * 카테고리 페이지의 `MarketNewsDigest` Suspense 경계 fallback — 다이제스트가 그려지기 전까지
 * 카드 표면으로 자리를 잡고, 스크린리더에는 `role="status"`로 불러오는 중임을 알린다.
 */
export function DigestSkeleton() {
    const t = useTranslations('app.news');
    return (
        <div
            aria-busy="true"
            role="status"
            aria-label={t('page.faef4a')}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <div className="mb-4 h-5 w-1/3 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="space-y-2">
                <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            </div>
        </div>
    );
}
