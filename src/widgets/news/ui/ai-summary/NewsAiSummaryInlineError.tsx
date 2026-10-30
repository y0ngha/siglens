'use client';

/**
 * 분석 실패 카드 — 오류 문구와 다시 시도 버튼.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { SummaryTitle } from './SummaryTitle';

interface NewsAiSummaryInlineErrorProps {
    error: Error;
    onRetry: () => void;
}

/** 오류 메시지는 `role="alert"`로 알린다. */
export function NewsAiSummaryInlineError({
    error,
    onRetry,
}: NewsAiSummaryInlineErrorProps) {
    const t = useTranslations('widgets.news');
    return (
        <section
            aria-labelledby="news-ai-summary-error-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden border-ui-danger/30 p-6'
            )}
        >
            <div className="mb-2">
                <SummaryTitle headingId="news-ai-summary-error-heading" />
            </div>
            <p
                className="text-sm wrap-break-word text-ui-danger-text"
                role="alert"
            >
                {error.message}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded bg-primary-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                {t('NewsAiSummary.0c767c')}
            </button>
        </section>
    );
}
