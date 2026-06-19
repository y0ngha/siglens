'use client';

import type { FallbackProps } from 'react-error-boundary';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function FinancialsAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const message =
        getFmpUserFacingMessage(error) ??
        (error instanceof Error
            ? error.message
            : '분석 중 오류가 발생했습니다.');

    return (
        <section
            aria-labelledby="financials-ai-summary-error-heading"
            className="border-ui-danger/30 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="financials-ai-summary-error-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                AI 재무제표 분석
            </h2>
            <p className="text-danger-text text-sm" role="alert">
                {message}
            </p>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 mt-4 inline-flex min-h-11 items-center rounded px-3 py-2 text-xs text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}
