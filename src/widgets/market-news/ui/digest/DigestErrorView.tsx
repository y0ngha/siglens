/**
 * 다이제스트 실패 카드.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface DigestErrorViewProps {
    error: Error;
    onRetry: () => void;
}

/** 오류 문구(`role="alert"`)와 "다시 시도" 버튼. 제목 id는 `market-news-digest-error-heading`이다. */
export function DigestErrorView({ error, onRetry }: DigestErrorViewProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <section
            aria-labelledby="market-news-digest-error-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden border-ui-danger/30 p-6'
            )}
        >
            <h2
                id="market-news-digest-error-heading"
                className={cn('mb-2', HEADING_SECTION)}
            >
                {t('MarketNewsDigest.69a497')}
            </h2>
            <div
                role="alert"
                className="text-sm wrap-break-word text-ui-danger-text"
            >
                {error.message}
            </div>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex min-h-11 items-center rounded bg-primary-600 px-3 py-2 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                {t('MarketNewsDigest.0c767c')}
            </button>
        </section>
    );
}
