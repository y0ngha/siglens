'use client';

import type { FallbackProps } from 'react-error-boundary';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function ChartErrorFallback({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const errorMessage =
        getFmpUserFacingMessage(error) ??
        (error instanceof Error
            ? error.message
            : '알 수 없는 오류가 발생했습니다.');

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-secondary-900/60">
            <span className="text-sm text-ui-danger-text">{errorMessage}</span>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="rounded bg-primary-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </div>
    );
}
