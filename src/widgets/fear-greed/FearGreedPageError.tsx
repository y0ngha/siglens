'use client';

import type { FallbackProps } from 'react-error-boundary';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

export function FearGreedPageError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const message =
        getFmpUserFacingMessage(error) ??
        '공포 탐욕 지수를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

    return (
        <section
            aria-labelledby="fear-greed-error-heading"
            className="rounded-lg border border-ui-danger/30 bg-secondary-800 p-6"
        >
            <h2
                id="fear-greed-error-heading"
                className={cn('mb-2', HEADING_SECTION)}
            >
                공포 탐욕 지수
            </h2>
            <div className="text-sm text-ui-danger" role="alert">
                {message}
            </div>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="mt-4 rounded bg-primary-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}
