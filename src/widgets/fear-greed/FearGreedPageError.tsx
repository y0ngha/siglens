'use client';

import type { FallbackProps } from 'react-error-boundary';

export function FearGreedPageError({ resetErrorBoundary }: FallbackProps) {
    return (
        <section
            aria-labelledby="fear-greed-error-heading"
            className="border-ui-danger/30 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="fear-greed-error-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                공포 탐욕 지수
            </h2>
            <div className="text-ui-danger text-sm" role="alert">
                공포 탐욕 지수를 불러오는 중 오류가 발생했습니다. 잠시 후 다시
                시도해주세요.
            </div>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 mt-4 rounded px-3 py-1.5 text-xs text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}
