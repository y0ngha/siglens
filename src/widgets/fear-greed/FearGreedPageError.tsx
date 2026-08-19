'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function FearGreedPageError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.fear-greed');
    const message =
        getFmpUserFacingMessage(error) ?? t('FearGreedPageError.f929f0');

    return (
        <section
            aria-labelledby="fear-greed-error-heading"
            className="rounded-xl border border-ui-danger/30 bg-secondary-800 p-6"
        >
            <h2
                id="fear-greed-error-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                {t('FearGreedPageError.f9482c')}
            </h2>
            <div className="text-sm text-ui-danger" role="alert">
                {message}
            </div>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="mt-4 rounded bg-primary-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                {t('FearGreedPageError.0c767c')}
            </button>
        </section>
    );
}
