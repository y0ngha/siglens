'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';

export function ChartErrorFallback({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.chart');
    // FMP 문구 키는 완전 수식이라 루트 번역자가 필요하다.
    const tRoot = useTranslations();
    const errorMessage =
        translateFmpError(error, tRoot) ??
        (error instanceof Error
            ? error.message
            : t('ChartErrorFallback.c9a3b4'));

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-secondary-900/60">
            <span className="text-sm text-ui-danger">{errorMessage}</span>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="rounded bg-primary-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none"
            >
                {t('ChartErrorFallback.0c767c')}
            </button>
        </div>
    );
}
