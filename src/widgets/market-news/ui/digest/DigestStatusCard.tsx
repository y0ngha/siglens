/**
 * 다이제스트를 만드는 동안의 로딩 카드.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/Spinner';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** 로딩 상태 전용 제목 id(`market-news-digest-status-heading`)로 스크린리더에 구분되는 맥락을 준다. */
export function DigestStatusCard() {
    const t = useTranslations('widgets.market-news');
    return (
        <section
            aria-labelledby="market-news-digest-status-heading"
            aria-busy="true"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6 motion-safe:animate-[fade-in_200ms_ease-out]'
            )}
        >
            <h2
                id="market-news-digest-status-heading"
                className={cn('mb-4', HEADING_SECTION)}
            >
                {t('MarketNewsDigest.69a497')}
            </h2>
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="flex items-center gap-3"
            >
                <Spinner />
                <p className="text-sm text-secondary-400">
                    {t('MarketNewsDigest.676ec8')}
                </p>
            </div>
            <div className="mt-4 space-y-2" aria-hidden="true">
                <div className="h-4 w-[91%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[67%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-[79%] animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
        </section>
    );
}
