'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SITE_NAME } from '@/shared/lib/seo';
import { reportClientError } from '@/shared/lib/reportClientError';

interface FearGreedErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/fear-greed` ISR route.
 *
 * `getMarketFearGreedStatic` already degrades gracefully (page-level `.catch`
 * falls back to an empty snapshot), so a thrown render here would only come
 * from an unexpected client/render bug rather than the usual FMP/Redis
 * flakiness. This boundary still contains that into a branded, retryable UI
 * instead of a bare 500. `reset()` re-renders the segment. Mirrors
 * `src/app/market/error.tsx`.
 */
export default function FearGreedError({ error, reset }: FearGreedErrorProps) {
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[FearGreedRoute] render error:', error);
        reportClientError(error, 'FearGreedRoute', error.digest);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                일시 오류
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                공포 탐욕 지수를 불러오지 못했어요
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                일시적인 오류로 지수를 표시하지 못했어요. 잠시 후 다시 시도해
                주세요.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    다시 시도
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {SITE_NAME} 홈으로
                </Link>
            </div>
        </main>
    );
}
