import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_INSET, SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** 보유종목이 0개인 회원에게 위치 카드 그리드 대신 보여 주는 안내 카드. */
export function PortfolioEmptyState() {
    const t = useTranslations('app.portfolio');
    return (
        <section
            data-testid="portfolio-empty-state"
            className={cn(SURFACE_CARD, 'flex flex-col items-start gap-3 p-6')}
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('page.ac9263')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.d103d5')}
            </p>
        </section>
    );
}

/** 보유종목 조회가 실패했을 때 페이지 안에서 보여 주는 안내 카드(루트 에러 경계로 번지지 않게). */
export function PortfolioErrorState() {
    const t = useTranslations('app.portfolio');
    return (
        <section
            data-testid="portfolio-error-state"
            className={cn(SURFACE_CARD, 'flex flex-col items-start gap-3 p-6')}
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('page.90a081')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.92020d')}
            </p>
        </section>
    );
}

/**
 * `PortfolioManager`의 Suspense fallback. 감싸는 `<section>`이 이미 테두리·배경·여백을 가지므로
 * 내부 블록만 채운다.
 */
export function PortfolioManagerSkeleton() {
    return (
        <div aria-hidden="true" className="animate-pulse space-y-4">
            <div className="space-y-2">
                <div className={cn('h-5 w-28 rounded', PLACEHOLDER_ON_INSET)} />
                <div className={cn('h-4 w-56 rounded', PLACEHOLDER_ON_INSET)} />
            </div>
            <div className={cn('h-14 rounded-lg', PLACEHOLDER_ON_INSET)} />
            <div className={cn('h-10 rounded-lg', PLACEHOLDER_ON_INSET)} />
        </div>
    );
}

function SkeletonCard() {
    return (
        <div
            aria-hidden="true"
            className={cn(
                'h-64 animate-pulse rounded-lg',
                PLACEHOLDER_ON_INSET
            )}
        />
    );
}

/** `PortfolioMemberArea`가 세션·보유종목을 읽는 동안의 페이지 Suspense fallback. */
export function PortfolioSkeleton() {
    const t = useTranslations('app.portfolio');
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="portfolio-loading"
        >
            <span className="sr-only">{t('page.605ada')}</span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map(i => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    );
}
