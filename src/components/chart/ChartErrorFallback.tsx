'use client';

import type { FallbackProps } from 'react-error-boundary';

export function ChartErrorFallback({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const errorMessage =
        error instanceof Error
            ? error.message
            : '알 수 없는 오류가 발생했습니다.';

    return (
        <div className="bg-secondary-900/60 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
            <span className="text-sm text-red-400">{errorMessage}</span>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="bg-primary-600 hover:bg-primary-700 rounded px-3 py-1.5 text-xs text-white transition-colors"
            >
                다시 시도
            </button>
        </div>
    );
}
